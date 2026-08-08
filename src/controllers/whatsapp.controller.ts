// src/controllers/whatsapp.controller.ts
import { Request, Response } from 'express';
import { metaWhatsAppWebhookSchema, extractInboundMessages } from '../schemas/whatsapp.schema';
import { handleInboundWhatsAppMessage } from '../services/lead-qualification.service';

/**
 * Meta's one-time subscription-verification handshake, fired when the
 * webhook URL is registered/re-verified in the App Dashboard. Must echo
 * back hub.challenge as plain text -- but only after checking hub.mode
 * AND hub.verify_token ourselves, per Meta's own spec, on top of the
 * :secret URL segment already checked by verifyWhatsAppWebhookSecret.
 * Enter the same WHATSAPP_WEBHOOK_SECRET value as the "Verify Token" when
 * subscribing the webhook in the App Dashboard.
 */
export const handleMetaWebhookVerification = (req: Request, res: Response): void => {
  const expectedToken = (process.env.WHATSAPP_WEBHOOK_SECRET || '').trim();

  if (req.query['hub.mode'] !== 'subscribe' || req.query['hub.verify_token'] !== expectedToken) {
    res.status(404).end();
    return;
  }

  res.status(200).send(req.query['hub.challenge']);
};

export const handleMetaWhatsAppWebhook = async (req: Request, res: Response): Promise<void> => {
  const parseResult = metaWhatsAppWebhookSchema.safeParse(req.body);

  // A malformed payload is our problem, not Meta's -- retrying it would
  // never succeed, so ack it and just log for investigation.
  if (!parseResult.success) {
    console.warn('[WhatsApp Webhook] Malformed payload:', parseResult.error.errors);
    res.status(200).json({ received: true });
    return;
  }

  try {
    const messages = extractInboundMessages(parseResult.data);
    for (const message of messages) {
      await handleInboundWhatsAppMessage(message);
    }
    res.status(200).json({ received: true });
  } catch (error) {
    // Meta retries webhook delivery on a non-2xx response. A processing
    // failure here is more likely transient (DB blip, etc.) than a bad
    // payload, so returning 500 lets Meta's retry recover the message
    // instead of us silently losing it.
    console.error('[WhatsApp Webhook] Failed to process inbound message:', error);
    res.status(500).json({ received: false });
  }
};
