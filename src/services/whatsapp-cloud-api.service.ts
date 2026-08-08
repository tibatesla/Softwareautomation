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

/**
 * Sends a plain-text message within an open 24-hour customer service
 * window (i.e. the contact has messaged us within the last 24 hours --
 * true for every reply our qualification bot sends, since it always
 * replies immediately after an inbound message). Re-engaging a contact
 * outside that window requires a pre-approved template message instead
 * (a different Graph API call), not needed for the qualification flow.
 */
export const sendWhatsAppText = async (waId: string, text: string): Promise<void> => {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error('Missing critical WHATSAPP_PHONE_NUMBER_ID environment configuration.');
  }
  const token = await resolveActiveSecret('meta', 'META_WHATSAPP_ACCESS_TOKEN');

  try {
    await axios.post(
      `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: waId,
        type: 'text',
        text: { body: text },
      },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (error) {
    const metaError = axios.isAxiosError(error) ? error.response?.data?.error : undefined;
    const detail = axios.isAxiosError(error) ? JSON.stringify(error.response?.data) : error;
    throw new WhatsAppSendError(`WhatsApp Cloud API message delivery failed: ${detail}`, metaError?.code);
  }
};
