// src/routes/agent-performance.routes.ts
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { getAgentPerformance } from '../controllers/agent-performance.controller';

const router = Router();

router.use(authenticateJWT);

// All authenticated roles -- the controller itself scopes an agent to only
// their own row/trend, owner/admin see the whole team (same shape as
// leads/properties/payments: role gating lives in the query, not the route).
router.get('/', getAgentPerformance);

export default router;
