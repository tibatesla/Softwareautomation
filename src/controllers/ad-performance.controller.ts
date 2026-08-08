// src/controllers/ad-performance.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { withRLSContext } from '../config/database';

export const listAdPerformance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const platform = typeof req.query.platform === 'string' ? req.query.platform : undefined;

  const logs = await withRLSContext(id, role, (tx) =>
    tx.adPerformanceLog.findMany({
      where: platform ? { platform: platform as 'meta' | 'google' | 'tiktok' } : undefined,
      orderBy: { windowStart: 'desc' },
      take: 500,
    }),
  );

  res.status(200).json(logs);
};

export const listAdRuleExecutions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const platform = typeof req.query.platform === 'string' ? req.query.platform : undefined;

  const executions = await withRLSContext(id, role, (tx) =>
    tx.adRuleExecution.findMany({
      where: platform ? { platform: platform as 'meta' | 'google' | 'tiktok' } : undefined,
      orderBy: { executedAt: 'desc' },
      take: 500,
    }),
  );

  res.status(200).json(executions);
};
