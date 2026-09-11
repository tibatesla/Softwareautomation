// src/routes/report.routes.ts
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { reportProperties, reportLeads, reportPayments, reportAdPerformance, reportAgentPerformance } from '../controllers/report.controller';

const router = Router();

router.use(authenticateJWT);

// Same access shape as each resource's own list endpoint -- RLS still
// scopes an agent's export to what they can already see (their assigned
// properties, their own leads/payments), this just mirrors the role gate.
router.get('/properties', reportProperties);
router.get('/leads', reportLeads);
router.get('/payments', reportPayments);
router.get('/ad-performance', requireRole('owner', 'admin'), reportAdPerformance);
router.get('/agent-performance', reportAgentPerformance);

export default router;
