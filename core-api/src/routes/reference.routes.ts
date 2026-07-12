import { Router } from "express";
import { getCities } from "../controllers/reference.controller";

const router = Router();

// No auth required — api-contract.md §2.10.
router.get("/reference/cities", getCities);

export default router;
