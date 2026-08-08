// src/routes/whatsapp.routes.ts
import { Router } from 'express';
import { verifyWhatsAppWebhookSecret, verifyMetaSignature } from '../middlewares/whatsapp-webhook.middleware';
import { handleMetaWebhookVerification, handleMetaWhatsAppWebhook } from '../controllers/whatsapp.controller';

const router = Router();

// Meta's one-time subscription-verification handshake (App Dashboard "Verify and Save").
router.get('/:secret', verifyWhatsAppWebhookSecret, handleMetaWebhookVerification);

// Real inbound webhook traffic -- URL secret AND a valid Meta HMAC signature required.
router.post('/:secret', verifyWhatsAppWebhookSecret, verifyMetaSignature, handleMetaWhatsAppWebhook);

export default router;
