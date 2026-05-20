import { DealerPromotion, type IDealerPromotion } from '../../models/DealerPromotion.model.js';
import { AppError } from '../../utils/AppError.js';
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from '../../utils/cloudinary.helpers.js';

/**
 * List active promotions for dealers.
 */
export async function listActivePromotions() {
  return DealerPromotion.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 });
}

/**
 * List all promotions for super admin dashboard with pagination/filters.
 */
export async function listAdminPromotions(query: Record<string, any> = {}) {
  const filter: Record<string, any> = {};

  if (query.isActive === 'true' || query.isActive === 'false') {
    filter.isActive = query.isActive === 'true';
  }

  if (typeof query.search === 'string' && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ title: searchRegex }, { description: searchRegex }];
  }

  const sortOrder = query.sort === 'asc' ? 1 : -1;

  return DealerPromotion.find(filter).sort({ sortOrder: 1, createdAt: sortOrder });
}

/**
 * Creates a new dealer promotion.
 */
export async function createPromotion(data: Record<string, any>, file?: Express.Multer.File) {
  let image: { url: string; publicId: string } | undefined;

  if (file) {
    const uploadResult = await uploadToCloudinary(file.buffer, 'vaniki/promotions');
    image = {
      url: uploadResult.url,
      publicId: uploadResult.publicId,
    };
  }

  const promotion = await DealerPromotion.create({
    title: data.title,
    description: data.description,
    image,
    isActive: data.isActive !== undefined ? String(data.isActive) === 'true' : true,
    sortOrder: data.sortOrder !== undefined ? Number(data.sortOrder) : 0,
  });

  return promotion;
}

/**
 * Updates an existing dealer promotion.
 */
export async function updatePromotion(id: string, data: Record<string, any>, file?: Express.Multer.File) {
  const promotion = await DealerPromotion.findById(id);
  if (!promotion) {
    throw new AppError('Promotion announcement not found', 404);
  }

  if (file) {
    // Delete old image if present
    if (promotion.image?.publicId) {
      await deleteFromCloudinary(promotion.image.publicId);
    }

    const uploadResult = await uploadToCloudinary(file.buffer, 'vaniki/promotions');
    promotion.image = {
      url: uploadResult.url,
      publicId: uploadResult.publicId,
    };
  }

  if (data.title !== undefined) promotion.title = data.title;
  if (data.description !== undefined) promotion.description = data.description;
  if (data.isActive !== undefined) promotion.isActive = String(data.isActive) === 'true';
  if (data.sortOrder !== undefined) promotion.sortOrder = Number(data.sortOrder);

  await promotion.save();
  return promotion;
}

/**
 * Deletes a dealer promotion.
 */
export async function deletePromotion(id: string) {
  const promotion = await DealerPromotion.findById(id);
  if (!promotion) {
    throw new AppError('Promotion announcement not found', 404);
  }

  if (promotion.image?.publicId) {
    await deleteFromCloudinary(promotion.image.publicId);
  }

  await promotion.deleteOne();
  return { success: true };
}
