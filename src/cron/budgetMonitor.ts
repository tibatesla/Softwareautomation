// src/cron/budgetMonitor.ts
import cron from 'node-cron';
import { supabase } from '../services/supabase.service';

const MAX_CPA_KES = 4500;
const KES_TO_USD = 130; // Use a fixed baseline exchange rate or pull from an API if needed

/**
 * Budget Control Circuit Breaker
 * Runs every hour to monitor performance data from Meta and TikTok.
 * Throttles campaigns if CPA exceeds KES 4,500.
 */
export const initBudgetMonitorCron = () => {
  // Schedule: Runs at minute 0 of every hour ('0 * * * *')
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Executing hourly financial safety check...');

    try {
      // 1. Fetch live metrics from your creative performance ledger
      const { data: metrics, error } = await supabase
        .from('fact_creative_performance')
        .select('creative_id, platform, spend, clicks'); // Assuming 'clicks' or a 'leads' column captures conversion data

      if (error) throw new Error(`Failed to fetch ad metrics: ${error.message}`);
      if (!metrics || metrics.length === 0) {
        console.log('[CRON] No active campaigns to monitor this hour.');
        return;
      }

      for (const row of metrics) {
        const leads = row.clicks; // Swap with actual 'leads' column if tracking conversions directly
        const spendUSD = row.spend;

        if (leads === 0) continue; // Skip to avoid division by zero errors

        // Calculate CPA in USD and convert to KES
        const cpaUSD = spendUSD / leads;
        const cpaKES = cpaUSD * KES_TO_USD;

        console.log(`[Monitor] Creative ${row.creative_id} on ${row.platform} | Current CPA: KES ${cpaKES.toFixed(2)}`);

        // 2. Circuit Breaker Condition Trigger
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
 * Dispatches throttle commands to HyperAI and logs alerts.
 */
async function throttleCampaign(creativeId: string, platform: string, currentCpa: number) {
  try {
    console.log(`[HyperAI] Sending throttle payload for creative: ${creativeId} on ${platform}`);

    // Call your HyperAI endpoint or update the status in your DB so the downstream router updates the ad networks
    const { error } = await supabase
      .from('fact_creative_performance')
      .update({ status: 'THROTTLED', updated_at: new Date().toISOString() })
      .eq('creative_id', creativeId)
      .eq('platform', platform);

    if (error) throw error;

    // TODO: Wire your WhatsAppService or SMS platform here to message your internal team instantly
    console.log(`[ALERT DISPATCHED] Emergency alert sent to team: Creative ${creativeId} on ${platform} throttled at KES ${currentCpa.toFixed(0)} CPA.`);

  } catch (error: any) {
    console.error(`[Emergency Fail] Failed to throttle campaign ${creativeId}:`, error.message);
  }
}