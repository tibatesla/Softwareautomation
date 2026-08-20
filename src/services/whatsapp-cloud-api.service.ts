// src/services/whatsapp-cloud-api.service.ts
//
// Client for Meta's own WhatsApp Business Cloud API (direct WABA access --
// replaces the Wati BSP layer, which was just a paid wrapper around this
// same underlying API). Auth: Bearer token (a Meta System User access
// token with whatsapp_business_messaging permission, resolved the same
// fail-closed way as the Marketing API token).
import axios from 'axios';
import { resolveActiveSecret } from './system-secrets.service';

const GRAPH_API_BASE = 'https://graph.facebook.com/v25.0';

// Meta's error code for "outside the 24h customer service window, needs a
// pre-approved template instead" -- callers that let a human pick who to
// message (e.g. an agent replying from the CRM, unlike the qualification
// bot which always replies immediately after an inbound message) need to
// distinguish this from other failures to give a useful error, not just
// "message failed."
export const WHATSAPP_REENGAGEMENT_WINDOW_CLOSED_CODE = 131047;

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = 'WhatsAppSendError';
  }
}

const postMessage = async (body: Record<string, unknown>): Promise<void> => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error('Missing critical WHATSAPP_PHONE_NUMBER_ID environment configuration.');
  }
  const token = await resolveActiveSecret('meta', 'META_WHATSAPP_ACCESS_TOKEN');

  try {
    await axios.post(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    const metaError = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
    const detail = axios.isAxiosError(error) ? JSON.stringify(error.response?.data) : error;
    throw new WhatsAppSendError(`WhatsApp Cloud API message delivery failed: ${detail}`, metaError?.code);
  }
};

/**
 * Sends a plain-text message within an open 24-hour customer service
 * window (i.e. the contact has messaged us within the last 24 hours --
 * true for every reply our qualification bot sends, since it always
 * replies immediately after an inbound message). Re-engaging a contact
 * outside that window requires a pre-approved template message instead
 * (a different Graph API call), not needed for the qualification flow.
 */
export const sendWhatsAppText = async (waId: string, text: string): Promise<void> => {
  await postMessage({
    messaging_product: 'whatsapp',
    to: waId,
    type: 'text',
    text: { body: text },
  });
};

export interface WhatsAppSlotOption {
  /** Opaque to Meta, echoed back verbatim in the webhook reply -- carries the slot's exact ISO datetime so picking one needs no parsing at all. */
  id: string;
  /** Meta caps list row titles at 24 characters -- truncated defensively here, but callers should already keep it short. */
  title: string;
  description?: string;
}

/**
 * Sends a tappable list of time-slot options instead of asking the lead to
 * type a date/time freehand -- fully native (no external link, no WhatsApp
 * Flows encryption/publishing overhead), and picking a row is deterministic
 * (no AI parsing, no ambiguity about what date they meant). Same 24-hour
 * window rule as sendWhatsAppText.
 */
export const sendWhatsAppSlotList = async (waId: string, bodyText: string, slots: WhatsAppSlotOption[]): Promise<void> => {
  await postMessage({
    messaging_product: 'whatsapp',
    to: waId,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText.slice(0, 4096) },
      action: {
        button: 'Pick a time',
        sections: [
          {
            rows: slots.slice(0, 10).map((slot) => ({
              id: slot.id,
              title: slot.title.slice(0, 24),
              ...(slot.description ? { description: slot.description.slice(0, 72) } : {}),
            })),
          },
        ],
      },
    },
  });
};
