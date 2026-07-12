import { Router } from "express";
import * as drivesController from "../controllers/drives.controller";
import { requireAuth } from "../middleware/require-auth";
import { requireOrganizer } from "../middleware/require-organizer";
import { writeRateLimit } from "../middleware/rate-limit";
import { validate } from "../middleware/validate";
import { idParamSchema } from "../schemas/users.schema";
import { createDriveSchema, updateDriveSchema } from "../schemas/drives.schema";

const router = Router();

// Donor-facing — api-contract.md §2.4 (JWT required)
router.get("/drives/:id", requireAuth, validate({ params: idParamSchema }), drivesController.getDriveDetail);
router.get("/drives/:id/slots", requireAuth, validate({ params: idParamSchema }), drivesController.getDriveSlots);
router.post("/drives/:id/waitlist", requireAuth, writeRateLimit, validate({ params: idParamSchema }), drivesController.joinWaitlist);
router.delete("/drives/:id/waitlist/me", requireAuth, validate({ params: idParamSchema }), drivesController.leaveWaitlist);

// Organizer drive management — api-contract.md §2.7 (JWT + isOrganizer; ownership
// checked in the service layer for the four :id-scoped routes below)
router.get("/organizer/drives", requireAuth, requireOrganizer, drivesController.listMyDrives);
router.post("/organizer/drives", requireAuth, requireOrganizer, writeRateLimit, validate({ body: createDriveSchema }), drivesController.createDrive);
router.patch("/organizer/drives/:id", requireAuth, requireOrganizer, validate({ params: idParamSchema, body: updateDriveSchema }), drivesController.updateDrive);
router.delete("/organizer/drives/:id", requireAuth, requireOrganizer, validate({ params: idParamSchema }), drivesController.deleteDrive);
router.get("/organizer/drives/:id", requireAuth, requireOrganizer, validate({ params: idParamSchema }), drivesController.getMyDriveDetail);
router.get("/organizer/drives/:id/slots/:slotId/bookings", requireAuth, requireOrganizer, drivesController.getSlotBookings);
router.get("/organizer/drives/:id/waitlist", requireAuth, requireOrganizer, drivesController.getWaitlist);
router.post("/organizer/drives/:id/waitlist/:userId/notify", requireAuth, requireOrganizer, writeRateLimit, drivesController.notifyWaitlisted);

export default router;
