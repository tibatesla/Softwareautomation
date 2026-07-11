// src/queues/video.worker.ts
import { videoGenerationQueue } from '../config/queue.config';
import { Job } from 'bull';
import { heygenService, ProcessVideoParams } from '../services/heygen.service';

// Hard enforcement limit matching your downstream rendering concurrency thresholds
const MAXIMUM_HEYGEN_CONCURRENCY = 10;

videoGenerationQueue.process(MAXIMUM_HEYGEN_CONCURRENCY, async (job: Job<ProcessVideoParams>) => {
  const { internal_db_id } = job.data;
  
  console.log(`[Worker Process] [Job:${job.id}] Initiating HeyGen synthesis pipeline for DB ID: ${internal_db_id}`);

  try {
    // Pipeline execution: Delegate directly to the HeyGen service
    await heygenService.processVideo(job.data);

    return {
      status: 'SUCCESS',
      internal_db_id
    };
  } catch (error: any) {
    const failureMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Worker Operational Failure] on Job ${job.id}:`, failureMessage);
    // Throwing the error here tells Redis/Bull that the job failed,
    // triggering the exponential backoff retry mechanism automatically.
    throw error;
  }
});

// Event Listeners for Queue Monitoring
videoGenerationQueue.on('completed', (job, result) => {
  console.log(`[Queue Master] Task completed successfully for Job ID ${job.id}.`);
});

videoGenerationQueue.on('failed', (job, err) => {
  const failedMessage = err instanceof Error ? err.message : String(err);
  console.error(`[Queue Master] Task failed for Job ID ${job.id}:`, failedMessage);
});