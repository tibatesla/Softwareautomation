// src/services/ad-ai-advisor.service.ts
//
// Advisory-only AI layer on top of the deterministic CPQL rule engine.
// Explicitly does NOT execute actions itself and does NOT warrant a
// specific ROAS/CPL outcome -- same framing as the MSA's Module 4
// acceptance criteria. It reads what the rule engine already decided and
// gives a plain-language recommendation a human can act on, logged
// alongside the rule engine's own entries so both are visible in one
// place (ad_rule_executions).
import axios from 'axios';
import { withSystemContext } from '../config/database';
import { AdProvider } from './system-secrets.service';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

export const generateAdvisory = async (platform: AdProvider, campaignId: string, adId: string): Promise<void> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('[Ad Advisor] Missing GROQ_API_KEY -- skipping advisory generation.');
    return;
  }

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
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are an ad performance advisor for a Kenyan real estate company. Give one short, specific, actionable recommendation (2-3 sentences max) based on the data. Do not promise a specific ROAS or CPL outcome -- only recommend an action and explain why.',
          },
          {
            role: 'user',
            content: `Platform: ${platform}\nCampaign: ${campaignId}\nAd: ${adId}\n\nRecent hourly performance:\n${summary}\n\nRecent rule engine decisions:\n${ruleHistory}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      },
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    const advisory = response.data.choices?.[0]?.message?.content?.trim();
    if (!advisory) return;

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
    console.error('[Ad Advisor] Groq request failed:', (error as Error).message);
  }
};
