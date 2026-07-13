// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';

/**
 * Extends the standard Express Request interface to include the raw byte buffer.
 * This is strictly required for HMAC-SHA256 cryptographic signature validation 
 * on incoming webhooks (e.g., HeyGen).
 */
export interface AuthenticatedRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Validates inbound webhook requests originating from Make.com 
 * (used for the Respond.io qualification synchronization).
 */
export const verifyMakeWebhookToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'] || req.headers['x-make-token'];
  const expectedToken = (process.env.MAKE_WEBHOOK_SECRET || '').trim();

  if (!expectedToken) {
    console.error('[CRITICAL] MAKE_WEBHOOK_SECRET is not defined in environment variables.');
    res.status(500).json({ error: 'Internal server configuration error' });
    return;
  }

  const rawHeader = (authHeader ?? '').toString().trim();
  const token = rawHeader.toLowerCase().startsWith('bearer ')
    ? rawHeader.slice(7).trim()
    : rawHeader;

  if (!token || token !== expectedToken) {
    // TEMP DEBUG — REMOVE after this works; logs lengths not full secrets
    //console.warn(`[Auth Debug] stripped token len=${token.length} vs expected len=${expectedToken.length}, equal=${token === expectedToken}`);
    //console.warn('[Security Firewall] 401 Blocked: Unauthorized Make.com intercept.');
    res.status(401).json({ error: 'Unauthorized webhook intercept: Invalid or missing token' });
    return;
  }

  next();
};
