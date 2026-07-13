// src/cron/index.ts
import { initSanitizationCron } from './sanitization';
import { initBudgetMonitorCron } from './budgetMonitor';
import { initGhlPollerCron } from './ghl-poller.cron';

/**
 * Initializes all automated system background jobs.
 */
export const initCronJobs = () => {
  console.log('[System] Initializing all engine cron processes...');

  initSanitizationCron();
  initBudgetMonitorCron();
  initGhlPollerCron(); // 
};