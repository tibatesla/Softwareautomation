// src/middlewares/rbac.middleware.ts
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, UserRole } from './auth.middleware';

/**
 * Fast app-layer role guard. This runs after authenticateJWT and rejects
 * before the request ever reaches the database. It is a UX/latency
 * optimization, not the security boundary — Postgres Row-Level Security
 * (see src/config/database.ts) is what actually enforces per-role data
 * access, since RLS holds even for code paths that bypass this middleware.
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient role for this operation' });
      return;
    }

    next();
  };
};
