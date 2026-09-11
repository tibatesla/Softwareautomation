// src/services/meta-capi.service.ts
//
// Meta Conversions API dispatch for WhatsApp-originated leads. This is
// deliberately NOT the generic Pixel-style CAPI shape (hashed email/phone,
// action_source: 'system_generated') that the rag spec assumed -- that's
// wrong for this flow. Verified against Meta's actual docs during Module
// 4 planning: WhatsApp/Business-Messaging conversions use
// action_source: 'business_messaging', messaging_channel: 'whatsapp', and
// user_data: { page_id, ctwa_clid } -- no hashed PII involved at all.
import axios from 'axios';
import { resolveActiveSecret } from './system-secrets.service';

const GRAPH_API_BASE = 'https://graph.facebook.com/v25.0';

interface BusinessMessagingEventInput {
  eventName: 'Lead' | 'Purchase';
  ctwaClid: string;
  // Shared between this server-side CAPI call and any future client-side
  // pixel/form event for the same conversion, so Meta merges them into one
  // conversion instead of double-counting -- callers pass a stable,
  // unique-per-conversion id (e.g. lead_qual_<leadId>, deposit_<paymentId>),
  // matching the CRM spec's event_id convention.
  eventId: string;
  currency?: string;
  value?: number;
}

/**
 * Fires a business-messaging conversion event (Lead or Purchase) so Meta's
 * ad algorithm learns which ad clicks turned into real leads/revenue.
 * Silently no-ops (does not throw) when ctwaClid is missing -- most
 * conversations today don't have one yet, since Module 3's capture of it is
 * a defensive best-effort (see whatsapp.schema.ts), not a guaranteed field.
 * A missing attribution ID is an expected, common case, not a system
 * failure worth halting on.
 */
const dispatchBusinessMessagingEvent = async (input: BusinessMessagingEventInput): Promise<void> => {
  if (!input.ctwaClid) {
    return;
  }

  const datasetId = process.env.META_DATASET_ID;
  const pageId = process.env.META_PAGE_ID;
  if (!datasetId || !pageId) {
    console.warn('[Meta CAPI] Missing META_DATASET_ID or META_PAGE_ID -- skipping dispatch.');
    return;
  }

  try {
    const token = await resolveActiveSecret('meta', 'META_CAPI_ACCESS_TOKEN');

    await axios.post(`${GRAPH_API_BASE}/${datasetId}/events`, {
      data: [
        {
          event_name: input.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: input.eventId,
          action_source: 'business_messaging',
          messaging_channel: 'whatsapp',
          user_data: {
            page_id: pageId,
            ctwa_clid: input.ctwaClid,
          },
          custom_data: {
            currency: input.currency || 'KES',
            value: input.value ?? 0,
          },
        },
      ],
    });
  } catch (error) {
    // A failed attribution signal shouldn't block or roll back the flow
    // that triggered it -- log and move on, same "reply send failure
    // doesn't undo lead capture" principle as Module 3.
    console.error('[Meta CAPI] Dispatch failed:', (error as Error).message);
  }
};

export const dispatchQualifiedLeadEvent = (input: Omit<BusinessMessagingEventInput, 'eventName'>): Promise<void> =>
  dispatchBusinessMessagingEvent({ ...input, eventName: 'Lead' });

/**
 * Fires when staff flag a recorded payment as the deposit (see
 * payment.controller.ts) -- a much stronger optimization signal for Meta's
 * ad algorithm than a Lead event, since it represents real revenue, not
 * just interest. Uses the same ctwa_clid attribution captured on the
 * originating lead, so the deposit is credited back to the ad click that
 * produced it.
 */
export const dispatchDepositPaidEvent = (input: Omit<BusinessMessagingEventInput, 'eventName'>): Promise<void> =>
  dispatchBusinessMessagingEvent({ ...input, eventName: 'Purchase' });
