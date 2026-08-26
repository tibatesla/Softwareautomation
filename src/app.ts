// src/app.ts
// Must be imported before any route modules: patches Express 4's router so
// a rejected promise from an async handler reaches the error middleware
// below instead of leaving the request hanging forever (see the handler's
// comment for why that matters).
import 'express-async-errors';
import express, { Application, NextFunction, Request, Response } from 'express';
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
import agentPerformanceRoutes from './routes/agent-performance.routes';
import publicPropertyRoutes from './routes/public-property.routes';
import publicBookingRoutes from './routes/public-booking.routes';
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

app.use('/api/agent-performance', agentPerformanceRoutes);

// Public customer website (chestoneproperties.com) -- no auth, read-only, field-restricted in the controller.
app.use('/api/public/properties', publicPropertyRoutes);

// Web booking link sent alongside the WhatsApp bot's tap-to-book buttons --
// no auth, gated by the unguessable token in the URL (see public-booking.controller.ts).
app.use('/api/public/bookings', publicBookingRoutes);

// Fallback for unhandled routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Catch-all error handler -- Express 4 does not catch rejected promises from
// async route handlers on its own, so a controller that throws without its
// own try/catch would otherwise hang the request forever (no response ever
// sent) until the reverse proxy's own timeout kills the connection. This is
// the last line of defense; controllers should still handle expected error
// cases (validation, not-found, conflicts) explicitly for a useful response.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error.' });
});

export default app;
