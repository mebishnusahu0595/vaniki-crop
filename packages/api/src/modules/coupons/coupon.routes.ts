import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as couponController from './coupon.controller.js';
import { requireAuth, requireStoreAdmin } from '../auth/auth.middleware.js';
import { validate, createCouponSchema, validateCouponSchema } from './coupon.validator.js';

const router: Router = Router();

/**
 * Rate limiter for coupon validation to prevent brute-forcing.
 * 10 requests per minute per IP.
 */
const validationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'Too many validation attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Public Routes ─────────────────────────────────────────────────────

/** POST /api/coupons/validate — Check validity and discount */
router.post('/validate', validationLimiter, validate(validateCouponSchema), couponController.validateCoupon);

// ─── Admin Routes ──────────────────────────────────────────────────

/** GET /api/admin/coupons — List all coupons (own store for storeAdmin) */
router.get('/admin', requireAuth, requireStoreAdmin, couponController.listCoupons);

/** POST /api/admin/coupons — Create new coupon */
router.post('/admin', requireAuth, requireStoreAdmin, validate(createCouponSchema), couponController.createCoupon);

/** PUT /api/admin/coupons/:id — Update coupon */
router.put('/admin/:id', requireAuth, requireStoreAdmin, couponController.updateCoupon);

/** DELETE /api/admin/coupons/:id — Deactivate coupon */
router.delete('/admin/:id', requireAuth, requireStoreAdmin, couponController.deactivateCoupon);

/** GET /api/admin/coupons/:id/usage — Get detailed usage stats */
router.get('/admin/:id/usage', requireAuth, requireStoreAdmin, couponController.getCouponUsage);

export default router;
