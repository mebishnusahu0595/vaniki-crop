import { Router } from 'express';
import * as reviewController from './review.controller.js';
import { requireAuth, requireStoreAdmin } from '../auth/auth.middleware.js';
import { validate, submitReviewSchema } from './review.validator.js';

const router: Router = Router();

// ─── Public Routes ─────────────────────────────────────────────────────

/** GET /api/reviews/product/:productId — List approved reviews */
router.get('/product/:productId', reviewController.getProductReviews);

// ─── Authenticated Routes ──────────────────────────────────────────────

/** POST /api/reviews — Submit review (require login) */
router.post('/', requireAuth, validate(submitReviewSchema), reviewController.submitReview);

/** DELETE /api/reviews/:id — Delete review (User/Admin) */
router.delete('/:id', requireAuth, reviewController.deleteReview);

// ─── Admin Moderation Routes ───────────────────────────────────────────

/** GET /api/admin/reviews — List moderation queue (pending/approved/rejected) */
router.get('/admin', requireAuth, requireStoreAdmin, reviewController.getPendingReviews);

/** PATCH /api/admin/reviews/:id/approve — Set isApproved=true */
router.patch('/admin/:id/approve', requireAuth, requireStoreAdmin, reviewController.approveReview);

/** PATCH /api/admin/reviews/:id/reject — Set status=rejected */
router.patch('/admin/:id/reject', requireAuth, requireStoreAdmin, reviewController.rejectReview);

export default router;
