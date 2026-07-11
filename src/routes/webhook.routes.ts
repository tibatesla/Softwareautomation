// src/routes/webhook.routes.ts
import { Router, Response } from 'express';
import crypto from 'node:crypto';

// Controllers
import { handleHeyGenWebhook } from '../controllers/heygen.controller';
import { handleRespondWebhook } from '../controllers/respond.controller';

// Middlewares & Interfaces
import { AuthenticatedRequest, verifyMakeWebhookToken } from '../middlewares/auth.middleware';

const router = Router();
const MAX_SKEW_SECONDS = 300; // 5 minutes expiration for replay protection

// ==========================================
// 1. HeyGen Webhook Integration
// ==========================================

// Handle standard CORS preflight requests
router.options('/heygen', (req: AuthenticatedRequest, res: Response) => {
  res.status(200).send('ok');
});

// HeyGen Secure Webhook Endpoint (Stage 4 Trigger)
router.post('/heygen', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const signature = req.header('Heygen-Signature');
    const timestamp = req.header('Heygen-Timestamp');

    if (!signature || !timestamp) {
      console.error('[Security Firewall] 401 Blocked: Missing signature or timestamp header.');
      res.status(401).json({ error: 'Unauthorized: Missing cryptographic headers.' });
      return;
    }

    // Replay Attack Prevention
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) {
      console.error('[Security Firewall] 400 Blocked: Stale timestamp detected (Replay Attack Prevention).');
      res.status(400).json({ error: 'Bad Request: Stale timestamp.' });
      return;
    }

    if (!req.rawBody) {
      console.error('[Security Firewall] 400 Blocked: Raw body buffer was not captured by app.ts.');
      res.status(400).json({ error: 'Bad Request: Raw buffer processing unavailable.' });
      return;
    }

    const secret = (process.env.HEYGEN_WEBHOOK_SECRET || '').trim();
    
    // Explicitly compute the hash against the exact raw buffer
    const expected = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('hex');

    const cleanSignature = (signature as string).trim();
    const sigBuf = Buffer.from(cleanSignature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');

    // Constant-time comparison to prevent timing attacks
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.error('[Security Firewall] 401 Blocked: Cryptographic signature mismatch!');
      res.status(401).json({ error: 'Unauthorized: Invalid security signature.' });
      return;
    }
    
    // Validation passed. Forward request to Stage 4 post-processing.
    await handleHeyGenWebhook(req, res);

  } catch (error) {
    console.error('[Fatal Ingestion Router Error]: Validation execution failure:', error);
    res.status(500).json({ error: 'Internal Server Validation Exception' });
  }
});

// ==========================================
// 2. Respond.io / Make.com Integration
// ==========================================

// Inbound POST mapping from Make.com (Respond.io Syncer)
router.post(
  '/respond-io',
  verifyMakeWebhookToken,
  handleRespondWebhook
);

export default router;