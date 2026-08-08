// src/queues/ad-action.queue.ts
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { AdProvider } from '../services/system-secrets.service';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null, // required by BullMQ
});

export type AdActionType = 'pause' | 'throttle_50' | 'scale_25' | 'none';

export interface AdActionJobData {
  platform: AdProvider;
  campaignId: string;
  adId: string;
  action: AdActionType;
}

export const adActionQueue = new Queue<AdActionJobData>('ad-actions', { connection });

export const enqueueAdAction = async (data: AdActionJobData): Promise<void> => {
  if (data.action === 'none') return;

  await adActionQueue.add('execute-ad-action', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
};
