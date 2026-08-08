// src/services/ad-ai-advisor.service.ts
//
// Advisory-only AI layer on top of the deterministic CPQL rule engine.
// Explicitly does NOT execute actions itself and does NOT warrant a
// specific ROAS/CPL outcome -- same framing as the MSA's Module 4
// acceptance criteria. It reads what the rule engine already decided and
// gives a plain-language recommendation a human can act on, logged
// alongside the rule engine's own entries so both are visible in one
// place (ad_rule_executions).
//
// Uses generateChatCompletion (ai-provider.service.ts): Groq first, a
// self-hosted Ollama instance as fallback if Groq fails or is
// unconfigured. This is a background/async call (a cron job, not a user
// waiting on a response), so it keeps the provider's generous default
// Ollama timeout rather than overriding it short.
import { withSystemContext } from '../config/database';
import { AdProvider } from './system-secrets.service';
import { generateChatCompletion } from './ai-provider.service';

export const generateAdvisory = async (platform: AdProvider, campaignId: string, adId: string): Promise<void> => {
  const context = await withSystemContext(async (tx) => {
    const recentLogs = await tx.adPerformanceLog.findMany({
      where: { platform, campaignId, adId },
      orderBy: { windowStart: 'desc' },
      take: 24,
    });
    const recentRules = await tx.adRuleExecution.findMany({
      where: { platform, campaignId, adId },
      orderBy: { executedAt: 'desc' },
      take: 10,
    });
    return { recentLogs, recentRules };
  });

  if (context.recentLogs.length === 0) return;

  const summary = context.recentLogs
    .map((l) => `${l.windowStart.toISOString()}: spend=${l.spend} impressions=${l.impressions} clicks=${l.clicks} qualifiedLeads=${l.qualifiedLeads} cpql=${l.cpql ?? 'n/a'}`)
    .join('\n');
  const ruleHistory = context.recentRules.map((r) => `${r.ruleName}: ${r.reason}`).join('\n');

  try {
    const advisory = await generateChatCompletion({
      systemPrompt:
        'You are an ad performance advisor for a Kenyan real estate company. Give one short, specific, actionable recommendation (2-3 sentences max) based on the data. Do not promise a specific ROAS or CPL outcome -- only recommend an action and explain why.',
      userMessage: `Platform: ${platform}\nCampaign: ${campaignId}\nAd: ${adId}\n\nRecent hourly performance:\n${summary}\n\nRecent rule engine decisions:\n${ruleHistory}`,
      temperature: 0.3,
      maxTokens: 200,
    });

    await withSystemContext((tx) =>
      tx.adRuleExecution.create({
        data: {
          ruleName: 'AI_ADVISORY',
          platform,
          campaignId,
          adId,
          actionTaken: 'none',
          reason: advisory,
          success: true,
        },
      }),
    );
  } catch (error) {
    console.error('[Ad Advisor] Both Groq and Ollama failed, skipping advisory:', (error as Error).message);
  }
};
