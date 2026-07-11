// src/config/queue.config.ts
import Queue from 'bull';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const videoGenerationQueue = new Queue('video-generation-pipeline', REDIS_URL, {
  settings: {
    lockDuration: 30000,
    stalledInterval: 30000,
    maxStalledCount: 2,
  },
});

// Explicit definition for worker orchestration payloads
export interface VideoJobPayload {
  leadId: string;
  clientName: string;
  propertyId: string;
  hashedEmail: string;
  hashedPhone: string;
  fbc: string | null;
  gclid: string | null;
}