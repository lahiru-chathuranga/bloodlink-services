import { Router } from "express";
import { getFeed } from "../controllers/home.controller";
import { requireAuth } from "../middleware/require-auth";

const router = Router();

// api-contract.md §2.3 — standalone home.routes.ts option (contract allows folding
// into users.routes.ts instead; kept separate here since it's a distinct aggregate).
router.get("/home/feed", requireAuth, getFeed);

export default router;
