// src/routes/payment.routes.ts
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { listPayments, getPayment, createPayment, updatePayment } from '../controllers/payment.controller';

const router = Router();

router.use(authenticateJWT);

// All authenticated roles: RLS scopes agents to payments on their own
// assigned properties, owner/admin see all. No delete -- ledger is append-only.
router.get('/', listPayments);
router.get('/:id', getPayment);
router.post('/', createPayment);

// Owner-only: correcting typos in an existing record, not general editing
// (see payments_owner_update RLS policy in migration 017).
router.patch('/:id', requireRole('owner'), updatePayment);

export default router;
