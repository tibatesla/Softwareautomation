// src/cron/budgetMonitor.ts
import cron from 'node-cron';
import { supabase } from '../services/supabase.service';
import { makeService } from '../services/make.service';

const MAX_CPA_KES = 4500;
const KES_TO_USD = 130;

export const initBudgetMonitorCron = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Executing hourly financial safety check...');

    try {
      const { data: metrics, error } = await supabase
        .from('fact_creative_performance')
        .select('creative_id, platform, spend, clicks');

      if (error) throw new Error(`Failed to fetch ad metrics: ${error.message}`);
      if (!metrics || metrics.length === 0) {
        console.log('[CRON] No active campaigns to monitor this hour.');
        return;
      }

      for (const row of metrics) {
        const leads = row.clicks;
        const spendUSD = row.spend;

        if (leads === 0) continue;

        const cpaUSD = spendUSD / leads;
        const cpaKES = cpaUSD * KES_TO_USD;

        console.log(`[Monitor] Creative ${row.creative_id} on ${row.platform} | Current CPA: KES ${cpaKES.toFixed(2)}`);

        if (cpaKES > MAX_CPA_KES) {
          console.warn(`[CIRCUIT BREAKER ALERT] CPA breached threshold! KES ${cpaKES.toFixed(2)} > KES ${MAX_CPA_KES}`);
          await throttleCampaign(row.creative_id, row.platform, cpaKES);
        }
      }
    } catch (error: any) {
      console.error('[CRON Fatal Error] Budget monitoring loop failed:', error.message);
    }
  });

  console.log('[System] Financial Safety Switch (Hourly CPA Monitor) initialized and active.');
};

/**
 * Dispatches a real throttle command to Make.com (which controls the
 * actual Meta/TikTok/Google ad accounts), and marks the row so this same
 * creative doesn't get re-throttled every hour once it's already paused.
 */
async function throttleCampaign(creativeId: string, platform: string, currentCpa: number) {
  try {
    // Dispatch FIRST — if this fails, we don't want the DB to claim
    // something is throttled when the actual ad platform never got the
    // command. Better to retry next hour (still spending, but at least
    // accurately tracked) than to silently mark it done and stop trying.
    await makeService.throttleCampaign(creativeId, platform, currentCpa);

    const { error } = await supabase
      .from('fact_creative_performance')
      .update({ status: 'THROTTLED', updated_at: new Date().toISOString() })
      .eq('creative_id', creativeId)
      .eq('platform', platform);

    if (error) throw error;

    console.log(`[ALERT DISPATCHED] Creative ${creativeId} on ${platform} throttled at KES ${currentCpa.toFixed(0)} CPA.`);

    // TODO: wire an actual notification (WhatsApp/SMS/Slack) here so a
    // human knows spend was just paused — a console.log nobody's watching
    // isn't a real alert. Confirm which channel you actually want before
    // building it; don't guess at another integration.
  } catch (error: any) {
    console.error(`[Emergency Fail] Failed to throttle campaign ${creativeId}:`, error.message);
  }
}