import { Category, type ICategory } from '../../models/Category.model.js';
import { Product } from '../../models/Product.model.js';
import { AppError } from '../../utils/AppError.js';
import {
  uploadImageUrlToCloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
} from '../../utils/cloudinary.helpers.js';
import { createPaginationResponse, parsePagination, type PaginatedResponse } from '../../utils/pagination.js';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.validator.js';
import { invalidateHomepageCache } from '../../utils/cache.helpers.js';

/**
 * Generates a URL-safe slug from a string.
 * @param text - The input string
 * @returns Slugified lowercase string
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

/**
 * Ensures a slug is unique by appending a numeric suffix if needed.
 * @param baseSlug - The initial slug
 * @param excludeId - Optional ID to exclude (for updates)
 * @returns Unique slug
 */
async function ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const query: any = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await Category.findOne(query);
    if (!existing) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
}

// ─── Public Services ─────────────────────────────────────────────────────

/**
 * Returns all active categories sorted by sortOrder.
 * Used by the customer-facing storefront.
 */
export async function getActiveCategories(): Promise<ICategory[]> {
  return Category.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .populate('parentCategory', 'name slug');
}

/**
 * Fetches a single category by slug, including products in that category.
 * @param slug - The category's URL slug
 * @param query - Pagination query params
 */
export async function getCategoryBySlug(
  slug: string,
  query: Record<string, any>,
): Promise<{ category: ICategory; products: PaginatedResponse<any> }> {
  const category = await Category.findOne({ slug, isActive: true })
    .populate('parentCategory', 'name slug');

  if (!category) {
    throw new AppError('Category not found', 404);
  }

  const { page, limit, skip } = parsePagination(query);

  const filter: any = { category: category._id, isActive: true };
  if (query.storeId) filter.storeId = query.storeId;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .select('name slug shortDescription images variants tags averageRating reviewCount isFeatured')
      .sort({ isFeatured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return {
    category,
    products: createPaginationResponse(products, total, page, limit),
  };
}

// ─── Admin Services ──────────────────────────────────────────────────────

/**
 * Returns all categories for admin (including inactive).
 */
export async function getAllCategoriesAdmin(
  query: Record<string, any>,
): Promise<PaginatedResponse<ICategory>> {
  const { page, limit, skip } = parsePagination(query);

  const filter: any = {};
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .populate('parentCategory', 'name slug')
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  return createPaginationResponse(categories, total, page, limit);
}

/**
 * Creates a new category with optional image upload.
 * @param input - Category data
 * @param file - Optional multer file (category image)
 */
export async function createCategory(
  input: CreateCategoryInput,
  file?: Express.Multer.File,
): Promise<ICategory> {
  const slug = await ensureUniqueSlug(slugify(input.name));
  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';

  let image;
  if (file) {
    image = await uploadToCloudinary(file.buffer, 'vaniki/categories');
  } else if (imageUrl) {
    image = await uploadImageUrlToCloudinary(imageUrl, 'vaniki/categories');
  }

  const category = await Category.create({
    ...input,
    slug,
    image,
  });

  await invalidateHomepageCache(); // Categories are global in homepage
  return category.populate('parentCategory', 'name slug');
}

/**
 * Updates a category by ID.
 * @param id - Category ObjectId
 * @param input - Fields to update
 * @param file - Optional new image file
 */
export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  file?: Express.Multer.File,
): Promise<ICategory> {
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError('Category not found', 404);
  }
  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';

  // If name changed, regenerate slug
  if (input.name && input.name !== category.name) {
    category.slug = await ensureUniqueSlug(slugify(input.name), id);
  }

  // Handle image update
  if (file || imageUrl) {
    // Delete old image from Cloudinary
    if (category.image?.publicId) {
      await deleteFromCloudinary(category.image.publicId);
    }
    const newImage = file
      ? await uploadToCloudinary(file.buffer, 'vaniki/categories')
      : await uploadImageUrlToCloudinary(imageUrl, 'vaniki/categories');
    category.image = newImage;
  }

  // Update fields
  if (input.name !== undefined) category.name = input.name;
  if (input.description !== undefined) category.description = input.description;
  if (input.parentCategory !== undefined) category.parentCategory = input.parentCategory as any;
  if (input.isActive !== undefined) category.isActive = input.isActive;
  if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;

  await category.save();
  await invalidateHomepageCache();
  return category.populate('parentCategory', 'name slug');
}

/**
 * Updates only active/inactive status of a category.
 * @param id - Category ObjectId
 * @param isActive - Desired active state
 */
export async function toggleCategoryActive(id: string, isActive: boolean): Promise<ICategory> {
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError('Category not found', 404);
  }

  category.isActive = isActive;
  await category.save();
  await invalidateHomepageCache();
  return category;
}

/**
 * Soft-deletes a category by setting isActive to false.
 * @param id - Category ObjectId
 */
export async function deleteCategory(id: string): Promise<ICategory> {
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError('Category not found', 404);
  }

  category.isActive = false;
  await category.save();
  await invalidateHomepageCache();
  return category;
}

/**
 * Permanently deletes a category.
 * Allowed only when category is inactive and has no linked products.
 * @param id - Category ObjectId
 */
export async function permanentlyDeleteCategory(id: string): Promise<void> {
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError('Category not found', 404);
  }

  if (category.isActive) {
    throw new AppError('Deactivate category before permanent delete', 400);
  }

  const linkedProducts = await Product.countDocuments({ category: category._id });
  if (linkedProducts > 0) {
    throw new AppError('Cannot delete category with linked products. Reassign or delete those products first.', 409);
  }

  if (category.image?.publicId) {
    await deleteFromCloudinary(category.image.publicId);
  }

  await category.deleteOne();
  await invalidateHomepageCache();
}
