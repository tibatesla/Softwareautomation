// src/routes/user.routes.ts
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { listUsers, getUser, createUser, updateUser, getOwnProfile, updateOwnDutyStatus } from '../controllers/user.controller';

const router = Router();

router.use(authenticateJWT);

// Self-service (agent SLA on-duty toggle) -- registered before the
// owner/admin-gated '/:id' routes below, since Express would otherwise
// match '/me' as an :id value and never reach these.
router.get('/me', getOwnProfile);
router.patch('/me/duty', updateOwnDutyStatus);

// Read: Owner/Admin -- Admin needs this to see agents available for
// property assignment (MSA Module 7), even though account management
// itself is Owner-only.
router.get('/', requireRole('owner', 'admin'), listUsers);
router.get('/:id', requireRole('owner', 'admin'), getUser);

// User management (create/deactivate/change role): Owner only, per MSA Module 8.
router.post('/', requireRole('owner'), createUser);
router.patch('/:id', requireRole('owner'), updateUser);

export default router;
