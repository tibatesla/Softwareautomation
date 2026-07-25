// src/cron/ghl-deals-poller.cron.ts
//
// Syncs GHL's "Chestone Property Sales" pipeline (Opportunities) into
// Supabase's `deals` table, on the same 10-minute interval as the
// property poller. Follows the identical pagination pattern as
// ghl-poller.cron.ts. Only writes to deal_stage_history when a deal's
// stage has actually changed since the last poll — not on every cycle —
// to avoid filling the history table with no-op rows.

import cron from 'node-cron';
import { supabase as supabaseAdmin } from '../services/supabase.service';

const GHL_API_TOKEN = process.env.GHL_API_TOKEN;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_PIPELINE_ID = process.env.GHL_SALES_PIPELINE_ID ?? '1vak7zcvtCVrHReFaJNW';
const GHL_BASE_URL = 'https://services.leadconnectorhq.com';

// Map GHL's real stage IDs to readable pipeline stage names.
// TODO: replace these placeholder keys with the real stage IDs pulled from:
// GET /opportunities/pipelines?locationId=... — see project notes.
const STAGE_ID_MAP: Record<string, string> = {
  REPLACE_WITH_REAL_ID_1: 'Virtual Site Visit Done',
  REPLACE_WITH_REAL_ID_2: 'Physical Site Visit Scheduled',
  REPLACE_WITH_REAL_ID_3: 'Physical Site Visit Done',
  REPLACE_WITH_REAL_ID_4: 'Offer Letter Signed',
  REPLACE_WITH_REAL_ID_5: 'Deposit Paid',
  REPLACE_WITH_REAL_ID_6: 'Commission Paid',
};

function mapGhlStageToPipelineStage(stageId: string): string {
  return STAGE_ID_MAP[stageId] || 'Unknown';
}

interface GHLOpportunity {
  id: string;
  name: string;
  pipelineStageId: string;
  contactId: string;
  monetaryValue?: number;
  contact?: {
    name?: string;
    phone?: string;
  };
  assignedTo?: string;
}

async function processOpportunity(opportunity: GHLOpportunity): Promise<void> {
  const newStage = mapGhlStageToPipelineStage(opportunity.pipelineStageId);

  const { data: existingDeal, error: fetchError } = await supabaseAdmin
    .from('deals')
    .select('id, pipeline_stage')
    .eq('ghl_opportunity_id', opportunity.id)
    .maybeSingle();

  if (fetchError) {
    console.error(`[Deals Poller] Failed to fetch existing deal for ${opportunity.id}:`, fetchError.message);
    return;
  }

  if (!existingDeal) {
    // First time seeing this opportunity — insert deal + seed history with
    // from_stage = null so the timeline shows where it started.
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('deals')
      .insert({
        ghl_opportunity_id: opportunity.id,
        contact_name: opportunity.contact?.name || opportunity.name || null,
        contact_phone: opportunity.contact?.phone || null,
        pipeline_stage: newStage,
        assigned_agent_id: opportunity.assignedTo || null,
        stage_updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error(`[Deals Poller] Failed to insert deal for ${opportunity.id}:`, insertError?.message);
      return;
    }

    const { error: historyError } = await supabaseAdmin.from('deal_stage_history').insert({
      deal_id: inserted.id,
      from_stage: null,
      to_stage: newStage,
    });

    if (historyError) {
      console.error(`[Deals Poller] Failed to write initial history for deal ${inserted.id}:`, historyError.message);
    }

    console.log(`[Deals Poller] New deal created: ${opportunity.id} → ${newStage}`);
  } else if (existingDeal.pipeline_stage !== newStage) {
    // Stage actually changed since last poll — this is the only condition
    // that should write a history row. Don't write on every poll, only on
    // an actual transition, or the table fills with no-op noise.
    const { error: updateError } = await supabaseAdmin
      .from('deals')
      .update({ pipeline_stage: newStage, stage_updated_at: new Date().toISOString() })
      .eq('id', existingDeal.id);

    if (updateError) {
      console.error(`[Deals Poller] Failed to update deal ${existingDeal.id}:`, updateError.message);
      return;
    }

    const { error: historyError } = await supabaseAdmin.from('deal_stage_history').insert({
      deal_id: existingDeal.id,
      from_stage: existingDeal.pipeline_stage,
      to_stage: newStage,
    });

    if (historyError) {
      console.error(`[Deals Poller] Failed to write history for deal ${existingDeal.id}:`, historyError.message);
    }

    console.log(`[Deals Poller] Deal ${existingDeal.id} stage changed: ${existingDeal.pipeline_stage} → ${newStage}`);
  }
  // else: no change, nothing to do — this is the normal, common case.
}

export const initGhlDealsPollerCron = () => {
  cron.schedule('*/10 * * * *', async () => {
    console.log('[CRON] Polling GoHighLevel for deal/pipeline stage changes...');

    if (!GHL_API_TOKEN || !GHL_LOCATION_ID) {
      console.warn('[Deals Poller] Missing GHL_API_TOKEN or GHL_LOCATION_ID in .env. Skipping poll.');
      return;
    }

    try {
      let startAfter: number | undefined = undefined;
      let startAfterId: string | undefined = undefined;
      let totalProcessed = 0;
      const limit = 100;

      while (true) {
        let url = `${GHL_BASE_URL}/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${GHL_PIPELINE_ID}&limit=${limit}`;
        if (startAfter && startAfterId) {
          url += `&startAfter=${startAfter}&startAfterId=${startAfterId}`;
        }

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${GHL_API_TOKEN}`,
            'Version': '2021-07-28',
          },
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`GHL Opportunities API Error: ${response.status} - ${errText}`);
        }

        const { opportunities, meta } = await response.json();

        if (!opportunities || opportunities.length === 0) {
          if (totalProcessed === 0) console.log('[Deals Poller] No opportunities found in this cycle.');
          break;
        }

        console.log(`[Deals Poller] Retrieved ${opportunities.length} opportunities this page. Processing...`);

        for (const opportunity of opportunities) {
          try {
            await processOpportunity(opportunity);
            totalProcessed += 1;
          } catch (oppError: any) {
            console.error(`[Deals Poller] Failed to process opportunity ${opportunity.id}:`, oppError.message);
          }
        }

        if (!meta.nextPageUrl || opportunities.length < limit) break;
        startAfter = meta.startAfter;
        startAfterId = meta.startAfterId;
      }

      console.log(`[Deals Poller] Cycle complete. Processed: ${totalProcessed}.`);
    } catch (error: any) {
      console.error('[CRON Fatal Error] Deals Poller execution failed:', error.message);
    }
  });

  console.log('[System] GoHighLevel Deals Polling Engine (10m interval) initialized.');
};
