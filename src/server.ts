// src/server.ts
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import 'dotenv/config';
import app from './app';
import { videoGenerationQueue } from './config/queue.config'; 
import './queues/video.worker'; 

// Import the unified Cron orchestrator instead of individual jobs
import { initCronJobs } from './cron'; 

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Note: Supabase connects via HTTP/REST seamlessly, so there is no database connection to manually open here.

    // Initialize all Background Automation (Sanitization & Budget Monitoring)
    initCronJobs(); 

    // Open Network Listener
    const server = app.listen(PORT, () => {
      console.log(`[Server] Chestone Pipeline running on port ${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV}`);
    });

    // Graceful Shutdown Management
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        console.log('[Server] HTTP connections closed.');
        
        // Safely pause and close the Redis queue to prevent task corruption
        await videoGenerationQueue.close();
        console.log('[Queue] Redis connections and worker threads closed safely.');
        
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('[Fatal Error] Failed to bootstrap the server:', error);
    process.exit(1);
  }
};

// Execute the bootstrap sequence
startServer();