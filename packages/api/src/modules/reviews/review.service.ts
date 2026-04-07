import { Review, type IReview } from '../../models/Review.model.js';
import { Product } from '../../models/Product.model.js';
import { AppError } from '../../utils/AppError.js';
import { createPaginationResponse, parsePagination } from '../../utils/pagination.js';

/**
 * Submits or updates a user's review for a product.
 * Enforces one review per user per product (upsert).
 */
export async function submitReview(userId: string, data: any) {
  const { productId, rating, comment } = data;

  const review = await Review.findOneAndUpdate(
    { productId, userId },
    { 
      rating, 
      comment, 
      isApproved: false // Require re-approval on edit
    },
    { upsert: true, new: true, runValidators: true }
  );

  return review;
}

/**
 * Fetches approved reviews for a specific product.
 */
export async function getProductReviews(productId: string, query: any) {
  const { page, limit, skip } = parsePagination(query);

  const [reviews, total] = await Promise.all([
    Review.find({ productId, isApproved: true })
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments({ productId, isApproved: true }),
  ]);

  return createPaginationResponse(reviews, total, page, limit);
}

/**
 * Admin: Fetches pending reviews for moderation.
 */
async function getStoreScopedProductIds(storeId?: string) {
  if (!storeId) return [];
  return Product.find({ storeId }).distinct('_id');
}

export async function getPendingReviews(query: any, userRole?: string, userStoreId?: string) {
  const { page, limit, skip } = parsePagination(query);
  const filter: any = { isApproved: false };

  if (userRole === 'storeAdmin' && userStoreId) {
    const productIds = await getStoreScopedProductIds(userStoreId);
    filter.productId = { $in: productIds };
  }

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('productId', 'name slug')
      .populate('userId', 'name email mobile')
      .sort({ createdAt: 1 }) // Oldest first for queue
      .skip(skip)
      .limit(limit),
    Review.countDocuments(filter),
  ]);

  return createPaginationResponse(reviews, total, page, limit);
}

/**
 * Admin: Approves a review.
 * Triggers Product stat recalculation via Mongoose post-save hook.
 */
export async function approveReview(reviewId: string, adminId: string, userRole?: string, userStoreId?: string) {
  const review = await Review.findById(reviewId);
  if (!review) {
    throw new AppError('Review not found', 404);
  }

  if (userRole === 'storeAdmin' && userStoreId) {
    const product = await Product.findOne({ _id: review.productId, storeId: userStoreId });
    if (!product) {
      throw new AppError('You can only approve reviews for your own store products', 403);
    }
  }

  review.isApproved = true;
  review.approvedBy = adminId as any;
  review.approvedAt = new Date();

  await review.save();
  return review;
}

/**
 * Admin/User: Deletes a review.
 * Triggers Product stat recalculation via Mongoose post-findOneAndDelete hook.
 */
export async function deleteReview(
  reviewId: string,
  userId?: string,
  isAdmin: boolean = false,
  userRole?: string,
  userStoreId?: string,
) {
  const filter: any = { _id: reviewId };
  if (!isAdmin && userId) {
    filter.userId = userId;
  }

  if (isAdmin && userRole === 'storeAdmin' && userStoreId) {
    const existingReview = await Review.findById(reviewId);
    if (!existingReview) {
      throw new AppError('Review not found or unauthorized', 404);
    }

    const product = await Product.findOne({ _id: existingReview.productId, storeId: userStoreId });
    if (!product) {
      throw new AppError('You can only delete reviews for your own store products', 403);
    }
  }

  const review = await Review.findOneAndDelete(filter);
  if (!review) {
    throw new AppError('Review not found or unauthorized', 404);
  }

  return { success: true };
}
