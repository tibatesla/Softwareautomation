// src/cron/token-refresh.cron.ts
//
// Meta long-lived tokens expire roughly every 60 days. This refreshes any
// Meta secret within REFRESH_WINDOW_DAYS of expiring, via Meta's
// documented token-exchange endpoint. Google's refresh_token doesn't
// expire on a fixed schedule (only on revocation) and TikTok's token
// lifecycle wasn't part of the verified research for this module -- both
// are intentionally left out of this daemon for now.
import cron from 'node-cron';
import axios from 'axios';
import { withSystemContext } from '../config/database';
import { upsertSecret } from '../services/system-secrets.service';

const REFRESH_WINDOW_DAYS = 10;
const META_TOKEN_LIFETIME_DAYS = 60;

export const runTokenRefresh = async (): Promise<void> => {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    console.warn('[Token Refresh] Missing META_APP_ID/META_APP_SECRET -- skipping.');
    return;
  }

  const dueSoon = new Date(Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const secretsNearingExpiry = await withSystemContext((tx) =>
    tx.systemSecret.findMany({
      where: { provider: 'meta', status: 'active', expiresAt: { lte: dueSoon } },
    }),
  );

  for (const secret of secretsNearingExpiry) {
    try {
      const response = await axios.get('https://graph.facebook.com/v25.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: secret.secretValue,
        },
      });

      const newExpiresAt = new Date(Date.now() + META_TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
      await upsertSecret('meta', secret.keyName, response.data.access_token, newExpiresAt);
      console.log(`[Token Refresh] Refreshed ${secret.keyName}, new expiry ${newExpiresAt.toISOString()}.`);
    } catch (error) {
      console.error(`[Token Refresh] Failed to refresh ${secret.keyName}:`, (error as Error).message);
    }
  }
};

export const initTokenRefreshCron = (): void => {
  cron.schedule('0 3 * * *', () => {
    runTokenRefresh().catch((error) => {
      console.error('[Token Refresh] Unhandled error in scheduled run:', error);
    });
  });
};
