import { Router } from "express";
import * as chatController from "../controllers/chat.controller";
import { requireAuth } from "../middleware/require-auth";
import { chatRateLimit } from "../middleware/rate-limit";
import { validate } from "../middleware/validate";
import { postMessageSchema } from "../schemas/chat.schema";

const router = Router();

// JWT required — api-contract.md §4.
router.get("/chat/history", requireAuth, chatController.getHistory);
router.post("/chat/messages", requireAuth, chatRateLimit, validate(postMessageSchema), chatController.postMessage);

export default router;
