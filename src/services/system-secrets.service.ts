// src/services/system-secrets.service.ts
//
// Fail-closed token resolution for the ad platform clients. This exists
// because of a documented bug class in this exact codebase's history: the
// original HeyGen webhook computed HMAC('', body) and accepted forged
// requests when its secret env var was unset, because it never checked
// for that case before using it. resolveActiveSecret() never falls back
// to an env var on a missing/expired secret -- it throws, and logs a
// SYSTEM_HALT row so the failure is visible in ad_rule_executions instead
// of silently degrading ad spend safety.
//
// The halt-log write and the throw are deliberately in SEPARATE
// withSystemContext calls, not one: throwing inside an open Prisma
// transaction rolls back everything written in that same transaction,
// including the very log row meant to record the failure. (Caught this
// exact mistake live during Module 4 verification -- see the platform's
// git history for the equivalent bug this pattern already fixed once in
// Module 3's WhatsApp reply-send flow.)
import { withSystemContext } from '../config/database';

export type AdProvider = 'meta' | 'google' | 'tiktok';

const logSystemHalt = async (provider: AdProvider, errorMessage: string): Promise<void> => {
  await withSystemContext((tx) =>
    tx.adRuleExecution.create({
      data: {
        ruleName: 'SYSTEM_HALT',
        platform: provider,
        actionTaken: 'failed',
        reason: errorMessage,
        success: false,
        errorDetail: errorMessage,
      },
    }),
  );
};

export const resolveActiveSecret = async (provider: AdProvider, keyName: string): Promise<string> => {
  const secret = await withSystemContext((tx) =>
    tx.systemSecret.findFirst({ where: { keyName, provider, status: 'active' } }),
  );

  if (!secret) {
    const errorMessage = `CRITICAL: Missing valid active secret for [${keyName}] (${provider}). Operations paused.`;
    console.error(errorMessage);
    await logSystemHalt(provider, errorMessage);
    throw new Error(errorMessage);
  }

  if (secret.expiresAt && secret.expiresAt.getTime() < Date.now()) {
    const errorMessage = `CRITICAL: Secret [${keyName}] (${provider}) is past its expiry. Operations paused.`;
    console.error(errorMessage);
    await withSystemContext((tx) => tx.systemSecret.update({ where: { id: secret.id }, data: { status: 'expired' } }));
    await logSystemHalt(provider, errorMessage);
    throw new Error(errorMessage);
  }

  return secret.secretValue;
};

/**
 * Upserts a secret value -- used by the token-refresh daemon (Meta) and
 * for initial manual seeding of Google/TikTok credentials via the DB.
 */
export const upsertSecret = async (
  provider: AdProvider,
  keyName: string,
  secretValue: string,
  expiresAt?: Date,
): Promise<void> => {
  await withSystemContext(async (tx) => {
    await tx.systemSecret.upsert({
      where: { keyName },
      create: { keyName, provider, secretValue, expiresAt, status: 'active' },
      update: { secretValue, expiresAt, status: 'active', lastRotatedAt: new Date() },
    });
  });
};
