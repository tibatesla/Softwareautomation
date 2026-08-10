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
  // The ad's ID, straight off the same referral object as ctwa_clid --
  // only meaningful when source_type is 'ad' (a CTWA post-click referral
  // has no ad to attribute to). This is what makes it possible to find
  // the matching ad_performance_logs row later; ctwa_clid alone can't,
  // since that only identifies the click, not the ad/campaign/window row.
  adSourceId?: string;
  // Which platform adSourceId belongs to -- required once adSourceId can
  // come from more than one platform, since Google and TikTok ad IDs
  // aren't guaranteed distinct from each other or from Meta's.
  adSourcePlatform?: 'meta' | 'google' | 'tiktok';
  whatsappMessageId?: string;
}

// Google and TikTok ads that click straight to WhatsApp have no
// equivalent to Meta's referral object -- Meta's webhook has no way of
// knowing a click came from another platform's ad. The workaround: the
// ad's destination is a wa.me link whose pre-filled text carries a
// reference code, e.g. "...(ref: GOOGLE-8821172)" -- see
// buildAdReferenceWhatsAppLink. Parsed back out of the first inbound
// message if the user sends it unedited; stripped from the stored text
// either way so it never shows up as literal chat content to an agent.
const AD_REFERENCE_PATTERN = /\(ref:\s*(GOOGLE|TIKTOK)-([A-Za-z0-9_-]{3,60})\)/i;

export const parseAdReferenceCode = (
  text: string,
): { cleanText: string; adSourceId: string; adSourcePlatform: 'google' | 'tiktok' } | null => {
  const match = text.match(AD_REFERENCE_PATTERN);
  if (!match) return null;

  return {
    cleanText: text.replace(AD_REFERENCE_PATTERN, '').trim(),
    adSourceId: match[2],
    adSourcePlatform: match[1].toLowerCase() as 'google' | 'tiktok',
  };
};

/**
 * Builds the wa.me destination URL for a Google/TikTok ad -- paste this
 * directly into the ad's "Message" / "Chat on WhatsApp" destination field
 * in Google Ads / TikTok Ads Manager. openingLine is the actual greeting
 * shown to the user; the reference code is appended, not the whole message,
 * so it still reads as a normal enquiry if left in place.
 */
export const buildAdReferenceWhatsAppLink = (
  phoneNumber: string,
  platform: 'google' | 'tiktok',
  adId: string,
  openingLine = "Hi! I'm interested in Chestone Properties.",
): string => {
  const text = `${openingLine} (ref: ${platform.toUpperCase()}-${adId})`;
  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`;
};

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
        const rawText = message.text?.body ?? '';
        // Meta's native referral (ad clicked directly on Meta) takes
        // priority when present; otherwise fall back to a parsed
        // reference code for Google/TikTok ads that click straight to
        // WhatsApp -- see parseAdReferenceCode below for why those need
        // a different capture mechanism entirely.
        const metaAdSourceId = message.referral?.source_type === 'ad' ? message.referral?.source_id : undefined;
        const parsedRef = metaAdSourceId ? null : parseAdReferenceCode(rawText);

        results.push({
          waId: message.from,
          text: parsedRef ? parsedRef.cleanText : rawText,
          messageType: message.type,
          senderName: contactsByWaId.get(message.from)?.trim() || undefined,
          ctwaClid: message.referral?.ctwa_clid,
          adSourceId: metaAdSourceId ?? parsedRef?.adSourceId,
          adSourcePlatform: metaAdSourceId ? 'meta' : parsedRef?.adSourcePlatform,
          whatsappMessageId: message.id,
        });
      }
    }
  }

  return results;
};
