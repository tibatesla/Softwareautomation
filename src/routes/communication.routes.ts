// src/routes/communication.routes.ts
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { sendBroadcast } from '../controllers/communication.controller';

const router = Router();

router.use(authenticateJWT);

// Owner/Admin only -- messaging a single lead or the entire lead list is a
// business-facing action, same access shape as every other social/marketing
// send in this app.
router.post('/broadcast', requireRole('owner', 'admin'), sendBroadcast);

export default router;
