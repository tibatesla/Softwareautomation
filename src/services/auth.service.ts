// src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { withSystemContext } from '../config/database';

export type UserRole = 'owner' | 'admin' | 'agent';

export interface TokenPayload {
  sub: string;
  role: UserRole;
  email: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

if (!JWT_SECRET) {
  throw new Error('Missing critical JWT_SECRET environment configuration.');
}

export const hashPassword = async (plain: string): Promise<string> => {
  return bcrypt.hash(plain, 10);
};

export const verifyPassword = async (plain: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(plain, hash);
};

export const signToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET as string) as TokenPayload;
};

/**
 * Looks up a user by email, verifies the password, and returns a signed
 * JWT plus the user's public profile. Uses withSystemContext (not
 * withRLSContext) because no user/role identity exists yet at login time --
 * this IS the process that establishes it. Returns null on any failure
 * (unknown email, wrong password, inactive account) so the controller can
 * respond with one generic 401 -- never reveal which specific check failed.
 */
export const login = async (
  email: string,
  password: string,
): Promise<{ token: string; user: AuthenticatedUser } | null> => {
  return withSystemContext(async (tx) => {
    const row = await tx.user.findUnique({ where: { email } });

    if (!row || !row.isActive) {
      return null;
    }

    const passwordMatches = await verifyPassword(password, row.passwordHash);
    if (!passwordMatches) {
      return null;
    }

    await tx.user.update({ where: { id: row.id }, data: { lastLoginAt: new Date() } });

    const user: AuthenticatedUser = {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      role: row.role as UserRole,
    };

    const token = signToken({ sub: user.id, role: user.role, email: user.email });

    return { token, user };
  });
};
