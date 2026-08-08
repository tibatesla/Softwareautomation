// src/cron/ad-performance-ingestion.cron.ts
import cron from 'node-cron';
import { withSystemContext } from '../config/database';
import { adPlatformClients } from '../services/ad-platforms';
import { AdProvider } from '../services/system-secrets.service';
import { runRuleEngine } from '../services/ad-rule-engine.service';

const PROVIDERS: AdProvider[] = ['meta', 'google', 'tiktok'];

const ingestPlatform = async (provider: AdProvider): Promise<void> => {
  const client = adPlatformClients[provider];

  let rows;
  try {
    rows = await client.pullPerformance(1);
  } catch (error) {
    // A missing/expired secret (resolveActiveSecret throwing) or a
    // platform outage for ONE provider shouldn't stop the other two from
    // ingesting -- log and move on to the next platform.
    console.error(`[Ad Ingestion] Failed to pull performance for ${provider}:`, (error as Error).message);
    return;
  }

  if (rows.length === 0) return;

  await withSystemContext(async (tx) => {
    for (const row of rows) {
      await tx.adPerformanceLog.upsert({
        where: {
          platform_campaignId_adId_windowStart: {
            platform: row.platform,
            campaignId: row.campaignId,
            adId: row.adId,
            windowStart: row.windowStart,
          },
        },
        create: row,
        update: {
          impressions: row.impressions,
          clicks: row.clicks,
          spend: row.spend,
        },
      });
    }
  });

  console.log(`[Ad Ingestion] Upserted ${rows.length} ${provider} rows.`);
};

export const runAdPerformanceIngestion = async (): Promise<void> => {
  for (const provider of PROVIDERS) {
    await ingestPlatform(provider);
  }
  await runRuleEngine();
};

export const initAdPerformanceIngestionCron = (): void => {
  // Hourly, matching the ad_performance_logs.window_start hourly-bucket design.
  cron.schedule('0 * * * *', () => {
    runAdPerformanceIngestion().catch((error) => {
      console.error('[Ad Ingestion] Unhandled error in scheduled run:', error);
    });
  });
};
