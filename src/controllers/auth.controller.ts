// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { loginSchema } from '../schemas/auth.schema';
import { login } from '../services/auth.service';

export const handleLogin = async (req: Request, res: Response): Promise<void> => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed login payload', details: parseResult.error.errors });
    return;
  }

  try {
    const result = await login(parseResult.data.email, parseResult.data.password);

    if (!result) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('[Auth] Login failure:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
