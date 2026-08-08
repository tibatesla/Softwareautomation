// src/routes/ad-performance.routes.ts
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { listAdPerformance, listAdRuleExecutions } from '../controllers/ad-performance.controller';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole('owner', 'admin'));

router.get('/', listAdPerformance);
router.get('/rule-executions', listAdRuleExecutions);

export default router;
