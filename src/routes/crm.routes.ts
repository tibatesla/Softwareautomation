// src/routes/crm.routes.ts
import { Router } from 'express';
import { CrmWebhookController } from '../controllers/crm.controller';
import { verifyLoftyWebhookSignature } from '../middlewares/auth.middleware';

const router = Router();
const controller = new CrmWebhookController();

router.post('/crm', verifyLoftyWebhookSignature, controller.handleInboundCrmEvent.bind(controller));

export default router;