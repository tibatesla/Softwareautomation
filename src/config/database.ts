// src/config/database.ts
import { PrismaClient, Prisma } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('Missing critical DATABASE_URL environment configuration.');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

/**
 * Runtime Prisma Client, connects as the least-privilege `app_user` role.
 * Every query should go through withRLSContext or withSystemContext below
 * so Postgres Row-Level Security is actually exercised, not just the raw
 * client on its own.
 */
export const prisma = new PrismaClient({ adapter });

export type AppRole = 'owner' | 'admin' | 'agent';

/**
 * Runs fn inside a Prisma interactive transaction with app.current_user_id /
 * app.current_role set via SET LOCAL (through parameterized set_config
 * calls, not string interpolation) so the RLS policies defined in
 * src/db/migrations scope every query to the caller's role and identity.
 * Interactive transactions pin all operations in fn to a single underlying
 * connection, which SET LOCAL requires to take effect across queries.
 */
export const withRLSContext = async <T>(
  userId: string,
  role: AppRole,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> => {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_role', ${role}, true)`;
    return fn(tx);
  });
};

/**
 * Narrow escape hatch for the one pre-auth code path that has no user/role
 * identity yet: the login lookup itself. Sets app.current_role = 'system',
 * which only the users_system_auth RLS policy (002_create_users.sql)
 * recognizes -- it is never derived from request input, only set here.
 */
export const withSystemContext = async <T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> => {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_role', 'system', true)`;
    return fn(tx);
  });
};
