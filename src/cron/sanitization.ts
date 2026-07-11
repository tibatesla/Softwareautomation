// src/cron/sanitization.ts
import cron from 'node-cron';
import { supabase } from '../services/supabase.service';

/**
 * 30-Day Data Purge
 * Sweeps the Supabase database daily at midnight to permanently delete 
 * ingested payloads and residual data that are older than 30 days.
 */
export const initSanitizationCron = () => {
  // Schedule: Runs at 00:00 (Midnight) every single day
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Initiating automated 30-day data sanitization sweep...');
    
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const targetDateStr = thirtyDaysAgo.toISOString();

      // Execute Supabase delete with explicit count modifier
      const { error, count } = await supabase
        .from('chestone_properties')
        .delete({ count: 'exact' })
        .lt('created_at', targetDateStr)
        .in('status', ['COMPLETED', 'FAILED']);

      if (error) {
        throw new Error(error.message);
      }

      console.log(`[CRON] Sanitization successful. Permanently purged ${count || 0} stale pipeline records.`);

    } catch (error: any) {
      console.error('[CRON Fatal Error] Failed to execute the data sanitization sweep:', error.message);
    }
  });

  console.log('[System] Compliance CRON job (30-Day Purge) initialized and active.');
};