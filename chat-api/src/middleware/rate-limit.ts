import rateLimit from "express-rate-limit";

// Own lightweight rate limiter, no shared proxy layer — decisions-log A5. Matters
// more here than on core-api since an unlimited Dialogflow-backed endpoint is a
// cost-inflation risk, not just a security one.
export const chatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests — try again shortly." } },
});
