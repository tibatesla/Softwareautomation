// src/app.ts
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import webhookRoutes from './routes/webhook.routes';
import testRoutes from './routes/test.routes';
import leadRoutes  from './routes/lead.routes';
import { AuthenticatedRequest } from './middlewares/auth.middleware'; // Needed for req.rawBody typing

const app: Application = express();

// Security Middleware
app.use(helmet());
app.use(cors({ origin: '*' }));

// Middleware: Strictly parse JSON but capture the raw buffer for HMAC validation
app.use(express.json({
  limit: '1mb',
  verify: (req: AuthenticatedRequest, res: Response, buf: Buffer) => {
    // Only capture the raw buffer for webhook routes to save memory
    if (req.originalUrl.startsWith('/api/webhooks')) {
      req.rawBody = buf;
    }
  }
}));

app.use(express.urlencoded({ extended: true }));

// Infrastructure Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Chestone Automation Pipeline is operational.',
    timestamp: new Date().toISOString()
  });
});
//testing
app.use('/rendered-videos', express.static('/home/tesla/chestone-pipeline/output'));

// Mount the core webhook routing tier
app.use('/api/webhooks', webhookRoutes);

// MOUNT THE TEST ROUTE HERE SO EXPRESS RECOGNIZES IT
app.use('/api', testRoutes);
//leads routes
app.use('/api', leadRoutes);


// Fallback for unhandled routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

export default app;