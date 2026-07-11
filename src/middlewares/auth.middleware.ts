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
  const expectedToken = process.env.MAKE_WEBHOOK_URL;

  if (!expectedToken) {
    console.error('[CRITICAL] MAKE_WEBHOOK_SECRET is not defined in environment variables.');
    res.status(500).json({ error: 'Internal server configuration error' });
    return;
  }

  // Support both "Bearer <token>" and raw token formats
  const token = authHeader?.toString().startsWith('Bearer ') 
    ? authHeader.toString().split(' ')[1] 
    : authHeader;

  if (!token || token !== expectedToken) {
    console.warn('[Security Firewall] 401 Blocked: Unauthorized Make.com intercept.');
    res.status(401).json({ error: 'Unauthorized webhook intercept: Invalid or missing token' });
    return;
  }

  next();
};