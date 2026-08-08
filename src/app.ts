// src/app.ts
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import propertyRoutes from './routes/property.routes';
import leadRoutes from './routes/lead.routes';
import bookingRoutes from './routes/booking.routes';
import paymentRoutes from './routes/payment.routes';
import userRoutes from './routes/user.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import adPerformanceRoutes from './routes/ad-performance.routes';
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
    message: 'Chestone Platform is operational.',
    timestamp: new Date().toISOString()
  });
});

// Auth
app.use('/api/auth', authRoutes);

// Module 2: Backend API
app.use('/api/properties', propertyRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);

// Module 3: WhatsApp lead capture
app.use('/api/webhooks/whatsapp', whatsappRoutes);

// Module 4: Ad Optimization Engine
app.use('/api/ad-performance', adPerformanceRoutes);

// Fallback for unhandled routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

export default app;
