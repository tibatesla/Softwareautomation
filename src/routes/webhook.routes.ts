// src/routes/webhook.routes.ts
import { Router, Response } from 'express';
import crypto from 'node:crypto';

import { handleHeyGenWebhook } from '../controllers/heygen.controller';
import { handleRespondWebhook } from '../controllers/respond.controller';
import { handleAdPerformanceWebhook } from '../controllers/ad-performance.controller';

import { AuthenticatedRequest, verifyMakeWebhookToken } from '../middlewares/auth.middleware';

const router = Router();

// ==========================================
// 1. HeyGen Webhook Integration
// ==========================================

router.options('/heygen', (req: AuthenticatedRequest, res: Response) => {
  // HeyGen validates endpoints with an OPTIONS preflight, 1-second timeout —
  // must respond fast, which this already does.
  res.status(200).send('ok');
});

router.post('/heygen', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // HeyGen's real signing scheme (confirmed from their docs): ONE header
    // called "Signature" — plain HMAC-SHA256 hex digest of the raw body.
    // There is no separate timestamp header in HeyGen's actual
    // implementation — the previous code checked for "Heygen-Signature"
    // and "Heygen-Timestamp", neither of which HeyGen sends, so every real
    // callback was being blocked regardless of the secret being correct.
    const signature = req.header('Signature');

    if (!signature) {
      console.error('[Security Firewall] 401 Blocked: Missing Signature header.');
      res.status(401).json({ error: 'Unauthorized: Missing signature header.' });
      return;
    }

    if (!req.rawBody) {
      console.error('[Security Firewall] 400 Blocked: Raw body buffer was not captured by app.ts.');
      res.status(400).json({ error: 'Bad Request: Raw buffer processing unavailable.' });
      return;
    }

    const secret = (process.env.HEYGEN_WEBHOOK_SECRET || '').trim();

    const expected = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('hex');

    const cleanSignature = signature.trim();
    const sigBuf = Buffer.from(cleanSignature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.error('[Security Firewall] 401 Blocked: Cryptographic signature mismatch!');
      res.status(401).json({ error: 'Unauthorized: Invalid security signature.' });
      return;
    }

    await handleHeyGenWebhook(req, res);

  } catch (error) {
    console.error('[Fatal Ingestion Router Error]: Validation execution failure:', error);
    res.status(500).json({ error: 'Internal Server Validation Exception' });
  }
});

// ==========================================
// 2. Respond.io / Make.com Integration
// ==========================================

router.post(
  '/respond-io',
  verifyMakeWebhookToken,
  handleRespondWebhook
);

// ==========================================
// 3. Ad Performance Sync (Make.com → CPA Monitor)
// ==========================================
router.post(
  '/ad-performance',
  verifyMakeWebhookToken,
  handleAdPerformanceWebhook
);

export default router;