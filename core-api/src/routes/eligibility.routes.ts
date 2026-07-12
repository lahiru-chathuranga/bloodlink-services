import { Router } from "express";
import { postEligibilityCheck } from "../controllers/eligibility.controller";
import { requireAuth } from "../middleware/require-auth";
import { validate } from "../middleware/validate";
import { eligibilityCheckSchema } from "../schemas/eligibility.schema";

const router = Router();

router.post(
  "/bookings/eligibility-check",
  requireAuth,
  validate({ body: eligibilityCheckSchema }),
  postEligibilityCheck,
);

export default router;
