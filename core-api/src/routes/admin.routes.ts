import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import { requireAdminSecret } from "../middleware/require-admin-secret";
import { validate } from "../middleware/validate";
import { idParamSchema } from "../schemas/users.schema";
import { staffInviteSchema, updateStaffSchema } from "../schemas/admin.schema";

const router = Router();

// Postman-only, X-Admin-Secret header, never JWT — api-contract.md §3.
router.post("/admin/staff-invite", requireAdminSecret, validate({ body: staffInviteSchema }), adminController.staffInvite);
router.post("/admin/staff/:id", requireAdminSecret, validate({ params: idParamSchema, body: updateStaffSchema }), adminController.updateStaff);

export default router;
