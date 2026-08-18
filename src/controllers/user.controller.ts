// src/controllers/user.controller.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { withRLSContext, withSystemContext } from '../config/database';
import { hashPassword } from '../services/auth.service';
import { createUserSchema, updateUserSchema, updateOwnDutySchema } from '../schemas/user.schema';

// Never include passwordHash in API responses.
const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  isOnDuty: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const listUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const users = await withRLSContext(id, role, (tx) =>
    tx.user.findMany({ select: publicUserSelect, orderBy: { createdAt: 'desc' } }),
  );
  res.status(200).json(users);
};

export const getUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const user = await withRLSContext(id, role, (tx) =>
    tx.user.findUnique({ where: { id: req.params.id }, select: publicUserSelect }),
  );

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.status(200).json(user);
};

export const createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = createUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed user payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;
  const passwordHash = await hashPassword(parseResult.data.password);

  try {
    const user = await withRLSContext(id, role, (tx) =>
      tx.user.create({
        data: {
          email: parseResult.data.email,
          passwordHash,
          fullName: parseResult.data.fullName,
          role: parseResult.data.role,
        },
        select: publicUserSelect,
      }),
    );
    res.status(201).json(user);
  } catch {
    res.status(409).json({ error: 'A user with that email already exists' });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = updateUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed user payload', details: parseResult.error.errors });
    return;
  }

  const { id, role } = req.user!;
  const { password, ...rest } = parseResult.data;
  const data = password ? { ...rest, passwordHash: await hashPassword(password) } : rest;

  try {
    const user = await withRLSContext(id, role, (tx) =>
      tx.user.update({ where: { id: req.params.id }, data, select: publicUserSelect }),
    );
    res.status(200).json(user);
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
};

/**
 * Owner-only (route + the bare users_owner_admin_all RLS policy, which
 * applies to all commands including DELETE once granted). Every relation
 * on User is a NoAction foreign key, so Postgres would reject this anyway
 * for a user with any history -- checked explicitly first so the caller
 * gets a clear, specific reason instead of a raw FK-violation error, and
 * so a user with real history can be pointed at deactivation instead.
 */
export const deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id, role } = req.user!;
  const targetId = req.params.id;

  if (targetId === id) {
    res.status(400).json({ error: "Can't delete your own account." });
    return;
  }

  try {
    const linked = await withRLSContext(id, role, (tx) =>
      tx.user.findUnique({
        where: { id: targetId },
        select: {
          role: true,
          _count: {
            select: {
              agentPenalties: true,
              bookings: true,
              leads: true,
              payments: true,
              assignedProperties: true,
              createdProperties: true,
              rotatedSecrets: true,
            },
          },
        },
      }),
    );

    if (!linked) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (linked.role === 'owner') {
      res.status(400).json({ error: "Can't delete an Owner account." });
      return;
    }

    const linkedCounts = Object.entries(linked._count).filter(([, count]) => count > 0);
    if (linkedCounts.length > 0) {
      const summary = linkedCounts.map(([name, count]) => `${count} ${name}`).join(', ');
      res.status(409).json({
        error: `Can't delete -- this user has linked records (${summary}). Deactivate the account instead to preserve that history.`,
      });
      return;
    }

    await withRLSContext(id, role, (tx) => tx.user.delete({ where: { id: targetId } }));
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
};

/**
 * Self-service: any authenticated user can read their own record. Not
 * behind requireRole('owner','admin') like GET /:id -- an agent has no
 * other way to see their own isOnDuty state (the agent SLA cron is the
 * only other reader/writer of that field).
 */
export const getOwnProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await withSystemContext((tx) =>
    tx.user.findUnique({ where: { id: req.user!.id }, select: publicUserSelect }),
  );
  res.status(200).json(user);
};

/**
 * Self-service on-duty toggle (agent SLA engine, Section 4). Deliberately
 * its own narrow endpoint rather than routing through updateUser: that one
 * is requireRole('owner') and accepts role/isActive/password, neither of
 * which a non-owner should ever be able to set on themselves. This uses
 * withSystemContext (bypasses RLS) rather than a new self-update RLS
 * policy -- safe here specifically because the target row is always
 * req.user!.id (never client-supplied) and the only field ever written is
 * isOnDuty, enforced by updateOwnDutySchema.
 */
export const updateOwnDutyStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parseResult = updateOwnDutySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Malformed payload', details: parseResult.error.errors });
    return;
  }

  const user = await withSystemContext((tx) =>
    tx.user.update({ where: { id: req.user!.id }, data: { isOnDuty: parseResult.data.isOnDuty }, select: publicUserSelect }),
  );
  res.status(200).json(user);
};
