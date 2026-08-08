// src/routes/auth.routes.ts
import { Router } from 'express';
import { handleLogin } from '../controllers/auth.controller';

const router = Router();

router.post('/login', handleLogin);

export default router;
