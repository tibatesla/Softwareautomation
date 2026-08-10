// src/cron/agent-sla.cron.ts
import cron from 'node-cron';
import { runAgentSlaCheck } from '../services/agent-sla.service';

export const initAgentSlaCron = (): void => {
  // Every minute, matching the CRM spec's "runs every 60 seconds" -- the
  // check itself is a no-op outside working hours (see isWithinWorkingHours
  // in agent-sla.service.ts), so this is cheap the rest of the day.
  cron.schedule('* * * * *', () => {
    runAgentSlaCheck().catch((error) => {
      console.error('[Agent SLA] Unhandled error in scheduled run:', error);
    });
  });
};
