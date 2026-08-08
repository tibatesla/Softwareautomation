// src/schemas/whatsapp.schema.ts
import { z } from 'zod';

// Meta's WhatsApp Cloud API webhook shape (Graph API "messages" field of a
// whatsapp_business_account subscription). One webhook call can carry
// multiple entries/changes, each with either a `messages` array (someone
// messaged us) or a `statuses` array (a delivery/read/sent receipt for one
// of OUR outbound messages) -- never both meaningfully at once. Only
// `messages` means "a contact sent us something"; a `statuses`-only change
// must be ignored, or the bot would react to its own replies being echoed
// back as delivery confirmations.
const metaWhatsAppMessageSchema = z
  .object({
    from: z.string().min(1), // sender's wa_id, digits only, no leading '+'
    id: z.string().optional(),
    timestamp: z.union([z.string(), z.number()]).optional(),
    type: z.string().optional(), // 'text', 'image', etc.
    text: z.object({ body: z.string() }).optional(),
    // Click-to-WhatsApp ad attribution. Present on the first inbound
    // message of a conversation that started from a CTWA ad -- Meta is
    // the authoritative source for this field (unlike the previous Wati
    // relay, which wasn't confirmed to reliably forward it).
    referral: z
      .object({
        source_url: z.string().optional(),
        source_type: z.string().optional(),
        source_id: z.string().optional(),
        headline: z.string().optional(),
        body: z.string().optional(),
        media_type: z.string().optional(),
        ctwa_clid: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const metaWhatsAppValueSchema = z
  .object({
    messaging_product: z.literal('whatsapp').optional(),
    metadata: z
      .object({ display_phone_number: z.string().optional(), phone_number_id: z.string().optional() })
      .passthrough()
      .optional(),
    contacts: z
      .array(
        z
          .object({
            profile: z.object({ name: z.string().optional() }).passthrough().optional(),
            wa_id: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    messages: z.array(metaWhatsAppMessageSchema).optional(),
    statuses: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const metaWhatsAppWebhookSchema = z
  .object({
    object: z.string(),
    entry: z.array(
      z
        .object({
          id: z.string().optional(),
          changes: z.array(
            z
              .object({
                field: z.string(),
                value: metaWhatsAppValueSchema,
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export type MetaWhatsAppWebhookPayload = z.infer<typeof metaWhatsAppWebhookSchema>;

// A single inbound message, normalized out of Meta's nested entry/changes
// shape so the qualification bot doesn't need to know about the wire
// format -- one webhook call can technically batch several messages.
export interface NormalizedInboundMessage {
  waId: string;
  text: string;
  messageType?: string;
  senderName?: string;
  ctwaClid?: string;
  whatsappMessageId?: string;
}

export const extractInboundMessages = (payload: MetaWhatsAppWebhookPayload): NormalizedInboundMessage[] => {
  const results: NormalizedInboundMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const messages = change.value?.messages;
      if (change.field !== 'messages' || !messages || messages.length === 0) {
        continue; // e.g. a statuses-only change (delivery/read receipt) -- not an inbound message
      }

      const contactsByWaId = new Map(
        (change.value?.contacts ?? []).map((contact) => [contact.wa_id, contact.profile?.name]),
      );

      for (const message of messages) {
        results.push({
          waId: message.from,
          text: message.text?.body ?? '',
          messageType: message.type,
          senderName: contactsByWaId.get(message.from)?.trim() || undefined,
          ctwaClid: message.referral?.ctwa_clid,
          whatsappMessageId: message.id,
        });
      }
    }
  }

  return results;
};
