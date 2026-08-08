// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken, UserRole } from '../services/auth.service';

export type { UserRole };

/**
 * Extends the standard Express Request interface to include the raw byte buffer
 * (needed for HMAC signature validation on future inbound webhooks) and the
 * authenticated user attached by authenticateJWT.
 */
export interface AuthenticatedRequest extends Request {
  rawBody?: Buffer;
  user?: {
    id: string;
    role: UserRole;
    email: string;
  };
}

/**
 * Verifies a Bearer JWT on the Authorization header and attaches the decoded
 * user identity to req.user. Every route that needs a logged-in user composes
 * this with requireRole (see rbac.middleware.ts).
 */
export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const rawHeader = (authHeader ?? '').toString().trim();

  if (!rawHeader.toLowerCase().startsWith('bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = rawHeader.slice(7).trim();

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
