import type { Request, Response, NextFunction } from 'express';
import * as reviewService from './review.service.js';

/**
 * POST /api/reviews
 * Submit or update a product review.
 */
export async function submitReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const review = await reviewService.submitReview(req.userId!, req.body);
    res.status(201).json({ success: true, data: review, message: 'Review submitted for moderation.' });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reviews/product/:productId
 * Public paginated listing of approved reviews.
 */
export async function getProductReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await reviewService.getProductReviews(req.params.productId as string, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/reviews
 * Admin: List pending reviews for moderation.
 */
export async function getPendingReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await reviewService.getPendingReviews(req.query, req.userRole, req.userStoreId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/reviews/:id/approve
 * Admin: Set isApproved to true.
 */
export async function approveReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const review = await reviewService.approveReview(req.params.id as string, req.userId!, req.userRole, req.userStoreId);
    res.status(200).json({ success: true, data: review, message: 'Review approved.' });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/reviews/:id
 * Delete a review (User can delete own, Admin can delete any).
 */
export async function deleteReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const isAdmin = req.userRole === 'superAdmin' || req.userRole === 'storeAdmin';
    await reviewService.deleteReview(req.params.id as string, req.userId!, isAdmin, req.userRole, req.userStoreId);
    res.status(200).json({ success: true, message: 'Review deleted.' });
  } catch (error) {
    next(error);
  }
}
