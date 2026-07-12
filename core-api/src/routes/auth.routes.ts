import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authRateLimit } from "../middleware/rate-limit";
import { validate } from "../middleware/validate";
import {
  checkEmailSchema,
  forgotPasswordSchema,
  loginSchema,
  resendOtpSchema,
  resetPasswordSchema,
  setPasswordSchema,
  verifyOtpSchema,
} from "../schemas/auth.schema";

const router = Router();

// No auth required on any route in this group — api-contract.md §2.1.
router.post("/auth/check-email", authRateLimit, validate({ body: checkEmailSchema }), authController.checkEmail);
router.post("/auth/resend-otp", authRateLimit, validate({ body: resendOtpSchema }), authController.resendOtp);
router.post("/auth/verify-otp", authRateLimit, validate({ body: verifyOtpSchema }), authController.verifyOtp);
router.post("/auth/set-password", authRateLimit, validate({ body: setPasswordSchema }), authController.setPassword);
router.post("/auth/login", authRateLimit, validate({ body: loginSchema }), authController.login);
router.post("/auth/forgot-password", authRateLimit, validate({ body: forgotPasswordSchema }), authController.forgotPassword);
router.post("/auth/reset-password", authRateLimit, validate({ body: resetPasswordSchema }), authController.resetPassword);

export default router;
