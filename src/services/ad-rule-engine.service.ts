// src/services/ad-rule-engine.service.ts
//
// CPQL (cost-per-qualified-lead) rule engine. Platform-agnostic: operates
// entirely on rows already sitting in ad_performance_logs, so it's fully
// testable with seeded data regardless of whether any live ad account is
// connected. Thresholds match the rag spec, which was concrete and never
// in question (unlike the platform API shapes, which needed verification).
//
// KNOWN GAP: qualified_leads on ad_performance_logs requires attributing a
// lead back to the specific ad that generated it (via ctwa_clid on Meta,
// or platform-equivalent click IDs elsewhere) -- that attribution pass
// isn't built yet, so qualified_leads is 0 for freshly ingested rows
// until it is. CPQL-dependent rules (breach, winner-scale) simply don't
// fire while it's 0 (cpql is null, same as the DB's generated column
// behavior) -- the CTR-friction and zero-qualified kill switches don't
// need it and work today.
//
// KNOWN GAP: domestic vs. diaspora CPQL caps require resolving each ad's
// target segment (campaign naming convention or a lookup table), which
// isn't wired in yet -- every ad currently evaluates against the domestic
// cap. Add a segment resolution step before trusting the diaspora
// KES 4,500 threshold in production.
import { withSystemContext } from '../config/database';
import { AdProvider } from './system-secrets.service';
import { enqueueAdAction, AdActionType } from '../queues/ad-action.queue';
import { generateAdvisory } from './ad-ai-advisor.service';

const DOMESTIC_CPQL_CAP = 2400;
const WINNER_CPQL_THRESHOLD = 1800;
const WINNER_MIN_SPEND = 5000;
const ZERO_QUALIFIED_SPEND_FLOOR = 3500;
const CTR_FRICTION_THRESHOLD_PCT = 1.2;
const CTR_FRICTION_SPEND_FLOOR = 2000;
const AGGREGATION_WINDOW_HOURS = 48;

interface AdAggregate {
  platform: AdProvider;
  campaignId: string;
  adId: string;
  spend: number;
  impressions: number;
  clicks: number;
  qualifiedLeads: number;
}

interface RuleEvaluationResult {
  action: AdActionType;
  ruleName: string;
  reason: string;
}

export const evaluateAd = (agg: Pick<AdAggregate, 'spend' | 'impressions' | 'clicks' | 'qualifiedLeads'>): RuleEvaluationResult => {
  const ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;
  const cpql = agg.qualifiedLeads > 0 ? agg.spend / agg.qualifiedLeads : null;

  if (agg.spend >= CTR_FRICTION_SPEND_FLOOR && ctr < CTR_FRICTION_THRESHOLD_PCT) {
    return {
      action: 'pause',
      ruleName: 'RULE_CTR_FRICTION',
      reason: `CTR is ${ctr.toFixed(2)}% (< ${CTR_FRICTION_THRESHOLD_PCT}%) after KES ${agg.spend.toFixed(2)} spend.`,
    };
  }

  if (agg.spend >= ZERO_QUALIFIED_SPEND_FLOOR && agg.qualifiedLeads === 0) {
    return {
      action: 'pause',
      ruleName: 'RULE_ZERO_QUALIFIED',
      reason: `Spent KES ${agg.spend.toFixed(2)} with 0 qualified leads.`,
    };
  }

  if (cpql !== null && cpql > DOMESTIC_CPQL_CAP) {
    return {
      action: 'throttle_50',
      ruleName: 'RULE_CPQL_BREACH',
      reason: `CPQL reached KES ${cpql.toFixed(2)} (cap KES ${DOMESTIC_CPQL_CAP}).`,
    };
  }

  if (cpql !== null && cpql <= WINNER_CPQL_THRESHOLD && agg.spend >= WINNER_MIN_SPEND) {
    return {
      action: 'scale_25',
      ruleName: 'RULE_WINNER_SCALE',
      reason: `CPQL is KES ${cpql.toFixed(2)}. Scaling budget +25%.`,
    };
  }

  return { action: 'none', ruleName: 'RULE_WITHIN_TARGET', reason: 'No threshold breached.' };
};

interface PostTransactionTask {
  agg: AdAggregate;
  result: RuleEvaluationResult;
}

/**
 * Runs evaluateAd() against every ad with logged activity in the last
 * AGGREGATION_WINDOW_HOURS and records each decision in ad_rule_executions.
 * Queueing the platform action and generating an AI advisory both involve
 * external calls (BullMQ/Redis, Groq) -- deliberately done AFTER the
 * transaction below commits, not inside it, same "don't let an external
 * call roll back a DB write" principle used throughout this codebase
 * (Module 3's reply-send, the CAPI dispatch). Calling withSystemContext
 * again from inside an already-open one would also just open a second,
 * independent connection -- cleaner to not nest it at all.
 */
export const runRuleEngine = async (): Promise<void> => {
  const tasks: PostTransactionTask[] = await withSystemContext(async (tx) => {
    const since = new Date(Date.now() - AGGREGATION_WINDOW_HOURS * 60 * 60 * 1000);

    const grouped = await tx.adPerformanceLog.groupBy({
      by: ['platform', 'campaignId', 'adId'],
      where: { windowStart: { gte: since } },
      _sum: { spend: true, impressions: true, clicks: true, qualifiedLeads: true },
    });

    const results: PostTransactionTask[] = [];

    for (const group of grouped) {
      const agg: AdAggregate = {
        platform: group.platform,
        campaignId: group.campaignId,
        adId: group.adId,
        spend: Number(group._sum.spend ?? 0),
        impressions: group._sum.impressions ?? 0,
        clicks: group._sum.clicks ?? 0,
        qualifiedLeads: group._sum.qualifiedLeads ?? 0,
      };

      const result = evaluateAd(agg);

      const performanceLog = await tx.adPerformanceLog.findFirst({
        where: { platform: agg.platform, campaignId: agg.campaignId, adId: agg.adId },
        orderBy: { windowStart: 'desc' },
        select: { id: true },
      });

      await tx.adRuleExecution.create({
        data: {
          adPerformanceLogId: performanceLog?.id,
          ruleName: result.ruleName,
          platform: agg.platform,
          campaignId: agg.campaignId,
          adId: agg.adId,
          actionTaken: result.action,
          reason: result.reason,
          success: true,
        },
      });

      results.push({ agg, result });
    }

    return results;
  });

  for (const { agg, result } of tasks) {
    if (result.action !== 'none') {
      await enqueueAdAction({
        platform: agg.platform,
        campaignId: agg.campaignId,
        adId: agg.adId,
        action: result.action,
      });
    }

    // Advisory only for the cases where a human most benefits from
    // context (something got paused or throttled) -- not on every ad,
    // every run, to keep Groq usage proportionate.
    if (result.action === 'pause' || result.action === 'throttle_50') {
      await generateAdvisory(agg.platform, agg.campaignId, agg.adId);
    }
  }
};
