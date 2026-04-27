import mongoose from 'mongoose';
import { Banner } from '../../models/Banner.model.js';
import { Category } from '../../models/Category.model.js';
import { Product } from '../../models/Product.model.js';
import { Testimonial } from '../../models/Testimonial.model.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import { redisConnection } from '../../config/redis.js';

const HOMEPAGE_CACHE_TTL = 300; // 5 minutes

/**
 * Aggregates all homepage data into a single responsive structure.
 * Includes Banners, Featured Categories, Sale Products, Best Sellers, and Testimonials.
 */
export async function getHomepageData(storeId?: string) {
  const cacheKey = storeId ? `analytics:homepage:store:${storeId}` : 'analytics:homepage:global';
  const cachedData = await redisConnection.get(cacheKey);
  if (cachedData) return JSON.parse(cachedData);

  const sId = storeId ? new mongoose.Types.ObjectId(storeId) : null;
  const now = new Date();

  // 1. Active Banners (Global + Store specific)
  const banners = await Banner.find({
    isActive: true,
    $or: [{ storeId: null }, ...(sId ? [{ storeId: sId }] : [])],
    $and: [
      { $or: [{ startDate: { $lte: now } }, { startDate: { $exists: false } }, { startDate: null }] },
      { $or: [{ endDate: { $gte: now } }, { endDate: { $exists: false } }, { endDate: null }] },
    ],
  })
    .sort({ sortOrder: 1, createdAt: -1 })
    .populate({
      path: 'linkedProducts.productId',
      select: 'name slug variants images isActive',
      match: { isActive: true },
    });

  const sanitizedBanners = banners.map((banner: any) => {
    const normalizedBanner = banner.toJSON();
    return {
      ...normalizedBanner,
      linkedProducts: (normalizedBanner.linkedProducts || []).filter((entry: any) => Boolean(entry?.productId)),
    };
  });

  // 2. Featured Categories (Top 8 circular)
  const featuredCategories = await Category.find({ isActive: true })
    .sort({ sortOrder: 1, createdAt: -1 })
    .limit(8);

  // 3. Sale Products (isFeatured=true, with discount calculating from first variant)
  // We use aggregation to calculate discount on the fly for sorting
  const saleProducts = await Product.aggregate([
    { 
      $match: { 
        isActive: true, 
        isFeatured: true,
        ...(sId ? { storeId: sId } : {})
      } 
    },
    {
      $addFields: {
        firstVariant: { $arrayElemAt: ['$variants', 0] }
      }
    },
    {
      $addFields: {
        discountPercent: {
          $cond: {
            if: { $gt: ['$firstVariant.mrp', 0] },
            then: { 
              $multiply: [
                { $divide: [{ $subtract: ['$firstVariant.mrp', '$firstVariant.price'] }, '$firstVariant.mrp'] },
                100
              ]
            },
            else: 0
          }
        }
      }
    },
    { $sort: { discountPercent: -1 } },
    { $limit: 10 },
    {
      $project: {
        name: 1,
        slug: 1,
        shortDescription: 1,
        images: 1,
        variants: 1,
        discountPercent: 1,
        totalSold: 1,
        averageRating: 1
      }
    }
  ]);

  // 4. Best Sellers (Higher totalSold)
  const bestSellers = await Product.find({ 
    isActive: true,
    ...(sId ? { storeId: sId } : {})
  })
    .sort({ totalSold: -1 })
    .limit(12)
    .populate('category', 'name slug');

  // 5. Testimonials
  // When a store is selected, include global + that store testimonials.
  // Without a selected store, show active testimonials across the platform.
  const testimonialFilter: Record<string, any> = { isActive: true };
  if (sId) {
    testimonialFilter.$or = [{ storeId: null }, { storeId: sId }];
  }

  const testimonials = await Testimonial.find(testimonialFilter)
    .sort({ sortOrder: 1, createdAt: -1 })
    .limit(6);

  // 6. Site Settings (for threshold and platform branding)
  const siteSettings = await SiteSetting.findOne({ singletonKey: 'default' });

  const result = {
    banners: sanitizedBanners,
    featuredCategories,
    saleProducts,
    bestSellers,
    testimonials,
    siteSettings
  };

  await redisConnection.setex(cacheKey, HOMEPAGE_CACHE_TTL, JSON.stringify(result));

  return result;
}
