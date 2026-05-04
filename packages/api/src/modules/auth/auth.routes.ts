import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';
import { upload } from '../../middleware/upload.js';
import {
  validate,
  signupSchema,
  dealerSignupSchema,
  loginSchema,
  serviceModeSchema,
  selectedStoreSchema,
  pushTokenSchema,
  updateMeSchema,
  changePasswordSchema,
  toggleWishlistSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validator.js';

const router: Router = Router();

// ─── Login Rate Limiter ──────────────────────────────────────────────────

/**
 * Rate limiter for login attempts.
 * Allows max 10 login attempts per IP per 15 minutes.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again later.',
  },
});

// ─── Public Routes ───────────────────────────────────────────────────────

/** POST /api/auth/signup — Register with mobile + password */
router.post('/signup', validate(signupSchema), authController.signup);

/** POST /api/auth/dealer-signup — Dealer self registration (pending approval) */
router.post('/dealer-signup', upload.single('profileImage'), validate(dealerSignupSchema), authController.dealerSignup);

/** POST /api/auth/login — Login with mobile + password */
router.post('/login', loginRateLimiter, validate(loginSchema), authController.login);

/** POST /api/auth/refresh — Refresh access token using httpOnly cookie */
router.post('/refresh', authController.refresh);

/** POST /api/auth/forgot-password — Send OTP for password reset */
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);

/** POST /api/auth/reset-password — Reset password after OTP verification */
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

/** POST /api/auth/firebase-login — Login with Firebase Phone Auth Token */
router.post('/firebase-login', loginRateLimiter, authController.firebaseLogin);

/** POST /api/auth/firebase-reset-password — Reset password with Firebase verification */
router.post('/firebase-reset-password', authController.firebaseResetPassword);

// ─── Protected Routes ────────────────────────────────────────────────────

/** POST /api/auth/logout — Clear refresh token */
router.post('/logout', requireAuth, authController.logout);

/** GET /api/auth/me — Get current user profile */
router.get('/me', requireAuth, authController.getMe);

/** PATCH /api/auth/me — Update current user profile */
router.patch('/me', requireAuth, validate(updateMeSchema), authController.updateMe);

/** PATCH /api/auth/me/profile-image — Update current user's profile image */
router.patch('/me/profile-image', requireAuth, upload.single('profileImage'), authController.updateProfileImage);

/** PATCH /api/auth/service-mode — Update delivery/pickup preference */
router.patch('/service-mode', requireAuth, validate(serviceModeSchema), authController.updateServiceMode);

/** PATCH /api/auth/selected-store — Update selected store */
router.patch('/selected-store', requireAuth, validate(selectedStoreSchema), authController.updateSelectedStore);

/** PATCH /api/auth/push-token — Update Expo push token */
router.patch('/push-token', requireAuth, validate(pushTokenSchema), authController.updatePushToken);

/** PATCH /api/auth/change-password — Update current password */
router.patch('/change-password', requireAuth, validate(changePasswordSchema), authController.changePassword);

/** PATCH /api/auth/wishlist/toggle — Add/remove wishlist item */
router.patch('/wishlist/toggle', requireAuth, validate(toggleWishlistSchema), authController.toggleWishlist);

export default router;
