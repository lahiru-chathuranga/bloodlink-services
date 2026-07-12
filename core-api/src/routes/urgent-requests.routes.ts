import { Router } from "express";
import * as urgentRequestsController from "../controllers/urgent-requests.controller";
import { requireAuth } from "../middleware/require-auth";
import { requireHospitalStaff } from "../middleware/require-hospital-staff";
import { validate } from "../middleware/validate";
import { idParamSchema } from "../schemas/users.schema";
import {
  createRequestSchema,
  listRequestsQuerySchema,
  staffDonorSearchQuerySchema,
} from "../schemas/urgent-requests.schema";

const router = Router();

// JWT required — api-contract.md §2.9.
router.get("/requests", requireAuth, validate({ query: listRequestsQuerySchema }), urgentRequestsController.listRequests);
router.post("/requests", requireAuth, validate({ body: createRequestSchema }), urgentRequestsController.createRequest);
router.get("/requests/:id", requireAuth, validate({ params: idParamSchema }), urgentRequestsController.getRequestById);
router.patch("/requests/:id/complete", requireAuth, validate({ params: idParamSchema }), urgentRequestsController.completeRequest);

// JWT + isHospitalStaff — api-contract.md §2.9, placed here per §5's route-file mapping.
router.get(
  "/staff/donors",
  requireAuth,
  requireHospitalStaff,
  validate({ query: staffDonorSearchQuerySchema }),
  urgentRequestsController.searchDonors,
);

export default router;
