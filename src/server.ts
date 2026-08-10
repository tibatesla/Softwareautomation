// src/server.ts
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import 'dotenv/config';
import app from './app';
import { prisma } from './config/database';
import { startAdActionWorker } from './workers/ad-action.worker';
import { initAdPerformanceIngestionCron } from './cron/ad-performance-ingestion.cron';
import { initTokenRefreshCron } from './cron/token-refresh.cron';
import { initAgentSlaCron } from './cron/agent-sla.cron';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Module 4: Ad Optimization Engine -- BullMQ worker + cron jobs
    const adActionWorker = startAdActionWorker();
    initAdPerformanceIngestionCron();
    initTokenRefreshCron();
    initAgentSlaCron();

    // Open Network Listener
    const server = app.listen(PORT, () => {
      console.log(`[Server] Chestone Platform running on port ${PORT}`);
      console.log(`[Server] Environment: ${process.env.NODE_ENV}`);
    });

    // Graceful Shutdown Management
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        console.log('[Server] HTTP connections closed.');

        await adActionWorker.close();
        console.log('[Queue] Ad action worker closed safely.');

        await prisma.$disconnect();
        console.log('[Database] Prisma client disconnected safely.');

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
