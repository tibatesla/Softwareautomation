// src/queues/video.worker.ts
import { videoGenerationQueue } from '../config/queue.config';
import { Job } from 'bull';
import { videoOrchestrator, ProduceVariantParams } from '../services/video-orchestrator.service';

// Keep concurrency LOW with the new architecture — each job now spawns
// HeyGen renders + Runway generations + multiple FFmpeg encodes. 2 parallel
// jobs is the safe ceiling on a laptop; 10 would melt it and rate-limit both APIs.
const MAX_CONCURRENCY = 2;

videoGenerationQueue.process(MAX_CONCURRENCY, async (job: Job<ProduceVariantParams>) => {
  const { internal_db_id, variant } = job.data;

  console.log(`[Worker] [Job:${job.id}] Starting ${variant} production for DB ID: ${internal_db_id}`);

  try {
    // ALL pipeline logic lives in the orchestrator (vision → scenes →
    // HeyGen chunks + Runway → synced assembly → upload → deploy).
    // The worker's only job is queue mechanics — don't add pipeline
    // steps here, that's what caused the TS2554 crash.
    await videoOrchestrator.produceVariantVideo(job.data);

    return { status: 'SUCCESS', internal_db_id, variant };
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Job ${job.id} (${variant}) failed:`, msg);
    throw error; // let Bull's retry/backoff handle it
  }
});

videoGenerationQueue.on('completed', (job) => {
  console.log(`[Queue] Job ${job.id} completed.`);
});

videoGenerationQueue.on('failed', (job, err) => {
  console.error(`[Queue] Job ${job.id} failed:`, err instanceof Error ? err.message : String(err));
});