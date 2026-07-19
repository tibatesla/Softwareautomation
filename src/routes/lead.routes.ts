// src/routes/lead.routes.ts
import { Router } from 'express';
import { handleLeadVideoLookup } from '../controllers/lead-video.controller';

const router = Router();

// GET /api/lead-video?location=Westlands&variant=Investment
router.get('/lead-video', handleLeadVideoLookup);

export default router;