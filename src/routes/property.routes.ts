// src/routes/property.routes.ts
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { uploadPropertyMedia } from '../middlewares/upload.middleware';
import {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  uploadPropertyMediaFile,
  deletePropertyMediaFile,
} from '../controllers/property.controller';

const router = Router();

router.use(authenticateJWT);

// List/read: all authenticated roles -- RLS scopes agents to their own assigned properties.
router.get('/', listProperties);
router.get('/:id', getProperty);

// Mutations: Owner/Admin only, per MSA Module 7 (property CRUD is an Admin/Owner function).
router.post('/', requireRole('owner', 'admin'), createProperty);
router.patch('/:id', requireRole('owner', 'admin'), updateProperty);

// Media: same Owner/Admin restriction as other property mutations.
router.post('/:id/media', requireRole('owner', 'admin'), uploadPropertyMedia, uploadPropertyMediaFile);
router.delete('/:id/media', requireRole('owner', 'admin'), deletePropertyMediaFile);

export default router;
