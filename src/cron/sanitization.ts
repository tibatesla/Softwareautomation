// src/cron/sanitization.ts
import cron from 'node-cron';
import { supabase } from '../services/supabase.service';

/**
 * 30-Day Lead PII Purge — MSA Section 7.2 compliance.
 *
 * "Lead data shall not be stored permanently within the middleware
 * environment. Residual lead data must be purged from the middleware
 * environment automatically within 30 days of processing."
 *
 * This is about BUYER/LEAD PII (names, phone numbers, hashed identifiers,
 * click IDs) — NOT property inventory. The original version of this file
 * deleted from `chestone_properties`, which would have permanently
 * destroyed real video/listing data the client needs to keep, while
 * leaving actual lead PII (the thing the contract requires purging)
 * completely untouched. That's backwards on both counts — fixed here.
 *
 * GHL itself is explicitly OUT of scope for this purge — GHL is the
 * Client's own CRM (Section 5.1, Client owns and controls it), not "the
 * middleware environment" the contract is talking about. Once a qualified
 * lead is synced into GHL as a Contact, that's the client's system of
 * record and hers to retain. This purge only concerns copies of lead PII
 * sitting in OUR OWN Supabase tables prior to/alongside that sync.
 *
 * CONFIRM BEFORE RELYING ON THIS: chestone_leads_attribution is the only
 * lead-PII table confirmed so far (from crm.controller.ts). If
 * respond.controller.ts writes raw lead data (phone, name, conversation
 * text) to a different table before syncing to GHL, that table needs a
 * purge/anonymize block added here too — check that file and add it.
 */
export const initSanitizationCron = () => {
  // Schedule: Runs at 00:00 (Midnight) every single day
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Initiating automated 30-day lead PII sanitization sweep...');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const targetDateStr = thirtyDaysAgo.toISOString();

      // chestone_leads_attribution: hard delete. Hashed email/phone are
      // derived directly from real PII and are crackable without a salt
      // (unsalted SHA-256 of a phone number/email is trivially reversible
      // via lookup tables), so they're treated as PII for purge purposes,
      // not as safely-anonymized data that could be kept indefinitely.
      const { error: leadError, count: leadCount } = await supabase
        .from('chestone_leads_attribution')
        .delete({ count: 'exact' })
        .lt('updated_at', targetDateStr);

      if (leadError) {
        throw new Error(`Lead attribution purge failed: ${leadError.message}`);
      }

      console.log(`[CRON] Purged ${leadCount || 0} stale lead attribution records (chestone_leads_attribution).`);

      // respond_conversations_log — confirmed live table (respond.controller.ts
      // writes phone_number + contact_id here on every inbound respond.io
      // webhook). This is the real lead PII the MSA's 30-day clause is about.
      const { error: respondError, count: respondCount } = await supabase
        .from('respond_conversations_log')
        .delete({ count: 'exact' })
        .lt('updated_at', targetDateStr);

      if (respondError) {
        throw new Error(`Respond.io conversation log purge failed: ${respondError.message}`);
      }

      console.log(`[CRON] Purged ${respondCount || 0} stale respond.io conversation records (respond_conversations_log).`);

      // TODO: add a second purge block here once respond.controller.ts is
      // confirmed — e.g.:
      //
      // const { error: respondError, count: respondCount } = await supabase
      //   .from('<table_respond_controller_writes_to>')
      //   .delete({ count: 'exact' })
      //   .lt('created_at', targetDateStr);
      //
      // if (respondError) throw new Error(`Respond.io lead purge failed: ${respondError.message}`);
      // console.log(`[CRON] Purged ${respondCount || 0} stale respond.io lead records.`);

    } catch (error: any) {
      console.error('[CRON Fatal Error] Failed to execute the lead PII sanitization sweep:', error.message);
    }
  });

  console.log('[System] Compliance CRON job (30-Day Lead PII Purge) initialized and active.');
};