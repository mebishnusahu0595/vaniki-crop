import { Review } from '../../models/Review.model.js';
import { Product } from '../../models/Product.model.js';
import { User } from '../../models/User.model.js';
import { AppError } from '../../utils/AppError.js';
import { createPaginationResponse, parsePagination } from '../../utils/pagination.js';

type ModerationStatus = 'pending' | 'approved' | 'rejected';

interface ModerationSummary {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function combineFilters(filters: Array<Record<string, any>>): Record<string, any> {
  const activeFilters = filters.filter((filter) => Object.keys(filter).length > 0);
  if (!activeFilters.length) return {};
  if (activeFilters.length === 1) return activeFilters[0] as Record<string, any>;
  return { $and: activeFilters };
}

function parseModerationStatus(value?: string): ModerationStatus | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'approved' || normalized === 'rejected') {
    return normalized;
  }
  throw new AppError('Invalid review status. Use pending, approved, or rejected.', 400);
}

function getStatusFilter(status?: ModerationStatus): Record<string, any> {
  if (!status) return {};

  if (status === 'approved') {
    return {
      $or: [
        { status: 'approved' },
        {
          isApproved: true,
          status: { $ne: 'rejected' },
        },
      ],
    };
  }

  if (status === 'pending') {
    return {
      $and: [
        { status: { $ne: 'rejected' } },
        { isApproved: { $ne: true } },
      ],
    };
  }

  return { status: 'rejected' };
}

async function resolveStoreScopedProductIds(storeId?: string) {
  if (!storeId) return [];
  return Product.find({ storeId }).distinct('_id');
}

async function buildBaseModerationFilter(query: any, userRole?: string, userStoreId?: string) {
  const filterParts: Array<Record<string, any>> = [];

  const requestedStoreId = typeof query.storeId === 'string' ? query.storeId.trim() : '';
  const scopedStoreId = userRole === 'storeAdmin' ? userStoreId : requestedStoreId || undefined;

  if (scopedStoreId) {
    const productIds = await resolveStoreScopedProductIds(scopedStoreId);
    filterParts.push({ productId: { $in: productIds } });
  }

  const productId = typeof query.productId === 'string' ? query.productId.trim() : '';
  if (productId) {
    filterParts.push({ productId });
  }

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    const [productIds, userIds] = await Promise.all([
      Product.find({ name: pattern }).distinct('_id'),
      User.find({
        $or: [{ name: pattern }, { mobile: pattern }, { email: pattern }],
      }).distinct('_id'),
    ]);

    const orConditions: Array<Record<string, any>> = [{ comment: pattern }];
    if (productIds.length) {
      orConditions.push({ productId: { $in: productIds } });
    }
    if (userIds.length) {
      orConditions.push({ userId: { $in: userIds } });
    }

    filterParts.push({ $or: orConditions });
  }

  return combineFilters(filterParts);
}

async function getModerationSummary(baseFilter: Record<string, any>): Promise<ModerationSummary> {
  const pipeline: any[] = [];
  if (Object.keys(baseFilter).length) {
    pipeline.push({ $match: baseFilter });
  }

  pipeline.push(
    {
      $addFields: {
        normalizedStatus: {
          $switch: {
            branches: [
              {
                case: { $eq: ['$status', 'rejected'] },
                then: 'rejected',
              },
              {
                case: {
                  $or: [{ $eq: ['$status', 'approved'] }, { $eq: ['$isApproved', true] }],
                },
                then: 'approved',
              },
            ],
            default: 'pending',
          },
        },
      },
    },
    {
      $group: {
        _id: '$normalizedStatus',
        count: { $sum: 1 },
      },
    },
  );

  const counts = await Review.aggregate(pipeline);
  const summary: ModerationSummary = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  };

  for (const entry of counts) {
    if (entry._id === 'pending') summary.pending = entry.count as number;
    if (entry._id === 'approved') summary.approved = entry.count as number;
    if (entry._id === 'rejected') summary.rejected = entry.count as number;
  }

  summary.total = summary.pending + summary.approved + summary.rejected;
  return summary;
}

async function findModeratableReview(reviewId: string, userRole?: string, userStoreId?: string) {
  const review = await Review.findById(reviewId);
  if (!review) {
    throw new AppError('Review not found', 404);
  }

  if (userRole === 'storeAdmin' && userStoreId) {
    const product = await Product.findOne({ _id: review.productId, storeId: userStoreId });
    if (!product) {
      throw new AppError('You can only moderate reviews for your own store products', 403);
    }
  }

  return review;
}

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
      status: 'pending',
      isApproved: false,
      approvedBy: undefined,
      approvedAt: undefined,
    },
    { upsert: true, new: true, runValidators: true },
  );

  return review;
}

/**
 * Fetches approved reviews for a specific product.
 */
export async function getProductReviews(productId: string, query: any) {
  const { page, limit, skip } = parsePagination(query);
  const approvedFilter = combineFilters([{ productId }, getStatusFilter('approved')]);

  const [reviews, total] = await Promise.all([
    Review.find(approvedFilter)
      .populate('userId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(approvedFilter),
  ]);

  return createPaginationResponse(reviews, total, page, limit);
}

/**
 * Admin: Fetches pending reviews for moderation.
 */
export async function getPendingReviews(query: any, userRole?: string, userStoreId?: string) {
  const status = parseModerationStatus(typeof query.status === 'string' ? query.status : undefined);
  const { page, limit, skip } = parsePagination(query);
  const baseFilter = await buildBaseModerationFilter(query, userRole, userStoreId);
  const finalFilter = combineFilters([baseFilter, getStatusFilter(status)]);

  const [reviews, total, summary] = await Promise.all([
    Review.find(finalFilter)
      .populate({
        path: 'productId',
        select: 'name slug images storeId',
        populate: { path: 'storeId', select: 'name' },
      })
      .populate('userId', 'name email mobile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(finalFilter),
    getModerationSummary(baseFilter),
  ]);

  const normalizedReviews = reviews.map((reviewDoc: any) => {
    const review = reviewDoc?.toJSON ? reviewDoc.toJSON() : reviewDoc;
    const normalizedStatus: ModerationStatus = review.status === 'rejected'
      ? 'rejected'
      : (review.isApproved || review.status === 'approved')
        ? 'approved'
        : 'pending';

    return {
      ...review,
      status: normalizedStatus,
    };
  });

  return {
    ...createPaginationResponse(normalizedReviews, total, page, limit),
    summary,
  };
}

/**
 * Admin: Approves a review.
 * Triggers Product stat recalculation via Mongoose post-save hook.
 */
export async function approveReview(reviewId: string, adminId: string, userRole?: string, userStoreId?: string) {
  const review = await findModeratableReview(reviewId, userRole, userStoreId);

  review.status = 'approved';
  review.isApproved = true;
  review.approvedBy = adminId as any;
  review.approvedAt = new Date();

  await review.save();
  return review;
}

/**
 * Admin: Rejects a review.
 */
export async function rejectReview(reviewId: string, userRole?: string, userStoreId?: string) {
  const review = await findModeratableReview(reviewId, userRole, userStoreId);

  review.status = 'rejected';
  review.isApproved = false;
  review.approvedBy = undefined;
  review.approvedAt = undefined;

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
