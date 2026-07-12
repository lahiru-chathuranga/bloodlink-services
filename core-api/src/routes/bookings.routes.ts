import { Router } from "express";
import * as bookingsController from "../controllers/bookings.controller";
import { requireAuth } from "../middleware/require-auth";
import { writeRateLimit } from "../middleware/rate-limit";
import { validate } from "../middleware/validate";
import { createBookingSchema } from "../schemas/bookings.schema";

const router = Router();

router.post("/bookings", requireAuth, writeRateLimit, validate({ body: createBookingSchema }), bookingsController.createBooking);
router.delete("/bookings/me", requireAuth, bookingsController.cancelMyBooking);

export default router;
