// src/routes/lead.routes.ts
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import {
  listLeads,
  getLead,
  createLead,
  updateLead,
  claimLead,
  listLeadMessages,
  sendLeadMessage,
} from '../controllers/lead.controller';

const router = Router();

router.use(authenticateJWT);

// List/read: all authenticated roles -- RLS scopes agents to leads they've
// claimed plus the unclaimed-qualified queue they can claim from.
router.get('/', listLeads);
router.get('/:id', getLead);
router.get('/:id/messages', listLeadMessages);

// Owner/Admin/Agent -- the claim-ownership check for Agents lives inside
// the controller (needs the lead's claimedByAgentId, not just the role),
// not requireRole, which only checks the role name.
router.post('/:id/messages', sendLeadMessage);

// Manual creation/edits: Owner/Admin only. (Automated intake -- WhatsApp/CAPI
// -- is a separate future integration, not this authenticated API surface.)
router.post('/', requireRole('owner', 'admin'), createLead);
router.patch('/:id', requireRole('owner', 'admin'), updateLead);

// Speed-to-lead claim: Agent only.
router.post('/:id/claim', requireRole('agent'), claimLead);

export default router;
