// src/controllers/agent-performance.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { computeAgentPerformance } from '../services/agent-performance.service';

export const getAgentPerformance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const result = await computeAgentPerformance(id, role);
  res.status(200).json(result);
};
