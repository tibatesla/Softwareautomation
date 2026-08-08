// src/routes/booking.routes.ts
import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { listBookings, getBooking, createBooking, updateBooking } from '../controllers/booking.controller';

const router = Router();

router.use(authenticateJWT);

// All authenticated roles: RLS scopes agents to their own bookings, owner/admin see all.
router.get('/', listBookings);
router.get('/:id', getBooking);
router.post('/', createBooking);
router.patch('/:id', updateBooking);

export default router;
