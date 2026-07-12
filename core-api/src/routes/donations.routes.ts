import { Router } from "express";
import * as donationsController from "../controllers/donations.controller";
import { requireAuth } from "../middleware/require-auth";
import { writeRateLimit } from "../middleware/rate-limit";
import { validate } from "../middleware/validate";
import { idParamSchema } from "../schemas/users.schema";
import { createDonationSchema } from "../schemas/donations.schema";

const router = Router();

// JWT + (isOrganizer owner OR isHospitalStaff) — access checked in the service
// layer since ownership needs a DB lookup (api-contract.md §2.8).
router.post(
  "/organizer/drives/:id/donations",
  requireAuth,
  writeRateLimit,
  validate({ params: idParamSchema, body: createDonationSchema }),
  donationsController.createDonation,
);
router.get(
  "/organizer/drives/:id/donation-stats",
  requireAuth,
  validate({ params: idParamSchema }),
  donationsController.getDonationStats,
);

export default router;
