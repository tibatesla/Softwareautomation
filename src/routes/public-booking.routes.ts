// src/routes/public-booking.routes.ts
//
// No authenticateJWT here on purpose -- see public-booking.controller.ts.
// Gated by the unguessable token in the URL itself, not by a login.
import { Router } from 'express';
import { getBookingOptions, confirmBooking } from '../controllers/public-booking.controller';

const router = Router();

router.get('/:token', getBookingOptions);
router.post('/:token', confirmBooking);

export default router;
