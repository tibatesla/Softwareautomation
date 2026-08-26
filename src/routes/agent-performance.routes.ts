// src/routes/agent-performance.routes.ts
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { getAgentPerformance } from '../controllers/agent-performance.controller';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole('owner'));

router.get('/', getAgentPerformance);

export default router;
