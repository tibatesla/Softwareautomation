// src/middlewares/whatsapp-webhook.middleware.ts
//
// Two layers, both fail-closed (never silently proceed on a missing
// secret -- this is the same rule a previous webhook in this codebase's
// history got wrong, see the platform security review):
//
// 1. verifyWhatsAppWebhookSecret -- an unguessable secret baked into the
//    URL path itself (only Meta's App Dashboard is configured with the
//    full URL). Also doubles as the hub.verify_token checked during
//    Meta's GET subscription-verification handshake.
// 2. verifyMetaSignature -- real cryptographic verification, unlike the
//    previous Wati integration which documented no HMAC scheme at all.
//    Meta signs every webhook POST body with X-Hub-Signature-256, an
//    HMAC-SHA256 over the raw body keyed by the Meta App Secret. Requires
//    the raw request buffer, which app.ts already captures onto
//    req.rawBody for every route under /api/webhooks.
import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from './auth.middleware';

export const verifyWhatsAppWebhookSecret = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  const expectedSecret = (process.env.WHATSAPP_WEBHOOK_SECRET || '').trim();

  if (!expectedSecret) {
    console.error('[CRITICAL] WHATSAPP_WEBHOOK_SECRET is not configured.');
    res.status(404).end();
    return;
  }

  const providedSecret = (req.params.secret || '').trim();

  const expectedBuf = Buffer.from(expectedSecret);
  const providedBuf = Buffer.from(providedSecret);

  const isValid =
    expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);

  if (!isValid) {
    // 404, not 401/403 -- don't confirm to a prober that this path exists at all.
    res.status(404).end();
    return;
  }

  next();
};

export const verifyMetaSignature = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const appSecret = (process.env.META_APP_SECRET || '').trim();

  if (!appSecret) {
    console.error('[CRITICAL] META_APP_SECRET is not configured.');
    res.status(404).end();
    return;
  }

  const signatureHeader = req.header('x-hub-signature-256') || '';
  const [scheme, providedDigest] = signatureHeader.split('=');

  if (scheme !== 'sha256' || !providedDigest || !req.rawBody) {
    res.status(404).end();
    return;
  }

  const expectedDigest = crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');

  const expectedBuf = Buffer.from(expectedDigest);
  const providedBuf = Buffer.from(providedDigest);

  const isValid =
    expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);

  if (!isValid) {
    res.status(404).end();
    return;
  }

  next();
};
