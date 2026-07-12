import { Router } from "express";
import multer from "multer";
import * as usersController from "../controllers/users.controller";
import { requireAuth } from "../middleware/require-auth";
import { validate } from "../middleware/validate";
import { writeRateLimit } from "../middleware/rate-limit";
import { idParamSchema, organizerRequestSchema, updateProfileSchema, updateVisibilitySchema } from "../schemas/users.schema";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// JWT required on all routes in this group — api-contract.md §2.2.
router.get("/users/me", requireAuth, usersController.getMe);
router.patch("/users/me/profile", requireAuth, validate({ body: updateProfileSchema }), usersController.updateProfile);
router.patch("/users/me/visibility", requireAuth, validate({ body: updateVisibilitySchema }), usersController.updateVisibility);
router.post("/uploads/avatar", requireAuth, writeRateLimit, upload.single("file"), usersController.uploadAvatar);
router.post("/users/me/organizer-request", requireAuth, validate({ body: organizerRequestSchema }), usersController.organizerRequest);
router.get("/users/me/donations", requireAuth, usersController.getDonations);
router.get("/users/me/donations/:id", requireAuth, validate({ params: idParamSchema }), usersController.getDonationById);
router.get("/users/me/alerts", requireAuth, usersController.getAlerts);
router.patch("/users/me/alerts/:id/read", requireAuth, validate({ params: idParamSchema }), usersController.markAlertRead);

export default router;
