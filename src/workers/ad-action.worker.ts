// src/workers/ad-action.worker.ts
//
// Consumes the ad-actions BullMQ queue and actually calls the relevant
// platform's pause/adjustBudget API -- rate-limited (shared across all
// three platforms; simple and conservative for now, revisit per-platform
// limits once real accounts are live and their actual limits are known
// from experience, not just documentation).
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { withSystemContext } from '../config/database';
import { adPlatformClients } from '../services/ad-platforms';
import { AdActionJobData } from '../queues/ad-action.queue';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const THROTTLE_FACTOR = 0.5;
const SCALE_FACTOR = 1.25;

const processJob = async (job: Job<AdActionJobData>): Promise<void> => {
  const { platform, campaignId, adId, action } = job.data;
  const client = adPlatformClients[platform];

  try {
    if (action === 'pause') {
      await client.pauseAd(adId);
    } else if (action === 'throttle_50') {
      await client.adjustBudget(campaignId, THROTTLE_FACTOR);
    } else if (action === 'scale_25') {
      await client.adjustBudget(campaignId, SCALE_FACTOR);
    }

    await withSystemContext((tx) =>
      tx.adRuleExecution.create({
        data: {
          ruleName: `${action.toUpperCase()}_EXECUTED`,
          platform,
          campaignId,
          adId,
          actionTaken: action,
          reason: `Successfully executed queued action against ${platform}.`,
          success: true,
        },
      }),
    );
  } catch (error) {
    await withSystemContext((tx) =>
      tx.adRuleExecution.create({
        data: {
          ruleName: `${action.toUpperCase()}_FAILED`,
          platform,
          campaignId,
          adId,
          actionTaken: action,
          reason: 'Platform API call failed.',
          success: false,
          errorDetail: (error as Error).message,
        },
      }),
    );
    throw error; // let BullMQ's retry/backoff handle it
  }
};

export const startAdActionWorker = (): Worker<AdActionJobData> => {
  return new Worker<AdActionJobData>('ad-actions', processJob, {
    connection,
    limiter: { max: 20, duration: 60_000 },
  });
};
