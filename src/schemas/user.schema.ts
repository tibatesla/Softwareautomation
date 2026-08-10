// src/schemas/user.schema.ts
import { z } from 'zod';

export const userRoleValues = ['owner', 'admin', 'agent'] as const;

// Owner is deliberately excluded here -- account management (create and
// role changes) is Owner-only, and an Owner must not be able to create or
// promote another account to Owner via this surface. There is intentionally
// no other way to mint an Owner account through the API.
export const manageableUserRoleValues = ['admin', 'agent'] as const;

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(manageableUserRoleValues).optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: z.enum(manageableUserRoleValues).optional(),
  isActive: z.boolean().optional(),
  // Owner-only password reset (see updateUser controller -- hashed before
  // it ever reaches the database, and the plaintext is never persisted or
  // echoed back).
  password: z.string().min(8).optional(),
});

// Self-service only (see updateOwnDutyStatus) -- deliberately just this one
// field, never routed through updateUserSchema's owner-only path, so a
// non-owner calling it can never touch role/isActive/password.
export const updateOwnDutySchema = z.object({
  isOnDuty: z.boolean(),
});

export type CreateUserPayload = z.infer<typeof createUserSchema>;
export type UpdateUserPayload = z.infer<typeof updateUserSchema>;
export type UpdateOwnDutyPayload = z.infer<typeof updateOwnDutySchema>;
