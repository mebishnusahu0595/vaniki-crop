import { Banner, type IBanner } from '../../models/Banner.model.js';
import { AppError } from '../../utils/AppError.js';
import {
  uploadBannerToCloudinary,
  uploadBannerUrlToCloudinary,
  deleteFromCloudinary,
} from '../../utils/cloudinary.helpers.js';
import { redisConnection } from '../../config/redis.js';
import { invalidateHomepageCache } from '../../utils/cache.helpers.js';

/**
 * Public listing of banners.
 * Returns global banners + store specific banners combined.
 */
export async function listActiveBanners(storeId?: string) {
  const now = new Date();
  const filter: any = {
    isActive: true,
    $or: [
      { storeId: null }, // Global
      ...(storeId ? [{ storeId }] : []), // Store specific
    ],
    $and: [
      { $or: [{ startDate: { $lte: now } }, { startDate: { $exists: false } }, { startDate: null }] },
      { $or: [{ endDate: { $gte: now } }, { endDate: { $exists: false } }, { endDate: null }] },
    ],
  };

  return Banner.find(filter)
    .sort({ sortOrder: 1, createdAt: -1 })
    .populate('linkedProducts.productId', 'name slug variants images');
}

export async function listAdminBanners(userRole: string, userStoreId?: string) {
  const filter: any = userRole === 'storeAdmin' && userStoreId ? { storeId: userStoreId } : {};
  return Banner.find(filter)
    .sort({ sortOrder: 1, createdAt: -1 })
    .populate('linkedProducts.productId', 'name slug variants images');
}

/**
 * Creates a new banner with hero image.
 */
export async function createBanner(data: any, file?: Express.Multer.File, userRole?: string, userStoreId?: string) {
  const imageUrl = typeof data.imageUrl === 'string' ? data.imageUrl.trim() : '';
  if (!file && !imageUrl) {
    throw new AppError('Banner image file or image URL is required', 400);
  }

  // Upload to Cloudinary
  const uploadResult = file
    ? await uploadBannerToCloudinary(file.buffer)
    : await uploadBannerUrlToCloudinary(imageUrl);

  // Parse linkedProducts if it's a JSON string from multipart
  let linkedProducts = [];
  if (typeof data.linkedProducts === 'string') {
    try {
      linkedProducts = JSON.parse(data.linkedProducts);
    } catch (e) {
      console.warn('Failed to parse linkedProducts JSON:', e);
    }
  }

  const banner = await Banner.create({
    ...data,
    storeId: userRole === 'storeAdmin' && userStoreId ? userStoreId : (data.storeId || null),
    image: {
      url: uploadResult.url,
      mobileUrl: uploadResult.mobileUrl,
      publicId: uploadResult.publicId,
    },
    linkedProducts,
  });

  await invalidateHomepageCache((userRole === 'storeAdmin' && userStoreId) ? userStoreId : data.storeId);
  return banner;
}

/**
 * Updates a banner.
 */
export async function updateBanner(id: string, data: any, file?: Express.Multer.File, userRole?: string, userStoreId?: string) {
  const banner = await Banner.findById(id);
  if (!banner) {
    throw new AppError('Banner not found', 404);
  }

  if (userRole === 'storeAdmin' && banner.storeId?.toString() !== userStoreId) {
    throw new AppError('You can only update your store banners', 403);
  }

  const imageUrl = typeof data.imageUrl === 'string' ? data.imageUrl.trim() : '';

  // Handle new image upload
  if (file || imageUrl) {
    // Delete old image
    await deleteFromCloudinary(banner.image.publicId);
    
    // Upload new image
    const uploadResult = file
      ? await uploadBannerToCloudinary(file.buffer)
      : await uploadBannerUrlToCloudinary(imageUrl);
    banner.image = {
      url: uploadResult.url,
      mobileUrl: uploadResult.mobileUrl,
      publicId: uploadResult.publicId,
    };
  }

  // Handle linkedProducts
  if (data.linkedProducts && typeof data.linkedProducts === 'string') {
    try {
      banner.linkedProducts = JSON.parse(data.linkedProducts);
    } catch (e) {
      console.warn('Failed to parse linkedProducts JSON:', e);
    }
  }

  // Update other fields
  const fieldsToUpdate = [
    'title', 'subtitle', 'ctaText', 'ctaLink', 
    'isActive', 'sortOrder', 'startDate', 'endDate'
  ];
  
  fieldsToUpdate.forEach(field => {
    if (data[field] !== undefined) {
      (banner as any)[field] = data[field];
    }
  });

  if (userRole !== 'storeAdmin' && data.storeId !== undefined) {
    banner.storeId = data.storeId || null;
  }

  await banner.save();
  await invalidateHomepageCache(banner.storeId?.toString());
  return banner;
}

/**
 * Deletes a banner and its associated image from Cloudinary.
 */
export async function deleteBanner(id: string, userRole?: string, userStoreId?: string) {
  const banner = await Banner.findById(id);
  if (!banner) {
    throw new AppError('Banner not found', 404);
  }

  if (userRole === 'storeAdmin' && banner.storeId?.toString() !== userStoreId) {
    throw new AppError('You can only delete your store banners', 403);
  }

  await deleteFromCloudinary(banner.image.publicId);
  await banner.deleteOne();
  
  await invalidateHomepageCache(banner.storeId?.toString());
  return { success: true };
}

/**
 * Reorders multiple banners.
 */
export async function reorderBanners(
  bannerOrders: Array<{ id: string; sortOrder: number }>,
  userRole?: string,
  userStoreId?: string,
) {
  if (userRole === 'storeAdmin' && userStoreId) {
    const ids = bannerOrders.map((item) => item.id);
    const banners = await Banner.find({ _id: { $in: ids }, storeId: userStoreId }).select('_id');
    if (banners.length !== bannerOrders.length) {
      throw new AppError('You can only reorder your store banners', 403);
    }
  }

  const operations = bannerOrders.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { sortOrder: item.sortOrder } },
    },
  }));

  await Banner.bulkWrite(operations);
  await invalidateHomepageCache(userRole === 'storeAdmin' ? userStoreId : undefined); // Invalidate global for safety
  return { success: true };
}
