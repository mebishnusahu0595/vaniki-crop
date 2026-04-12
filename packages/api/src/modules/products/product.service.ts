import mongoose from 'mongoose';
import { Product, type IProduct } from '../../models/Product.model.js';
import { Category } from '../../models/Category.model.js';
import { Review } from '../../models/Review.model.js';
import { Store } from '../../models/Store.model.js';
import { AppError } from '../../utils/AppError.js';
import {
  uploadMultipleToCloudinary,
  uploadImageUrlToCloudinary,
  deleteFromCloudinary,
} from '../../utils/cloudinary.helpers.js';
import {
  createPaginationResponse,
  parsePagination,
  type PaginatedResponse,
} from '../../utils/pagination.js';
import type { CreateProductInput, UpdateProductInput } from './product.validator.js';
import { invalidateHomepageCache } from '../../utils/cache.helpers.js';

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Generates a URL-safe slug from a string.
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
 * Ensures a product slug is unique.
 */
async function ensureUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const query: any = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await Product.findOne(query);
    if (!existing) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
}

/**
 * Builds a sort object from the sort query param.
 */
function buildSortOptions(sort?: string): Record<string, 1 | -1> {
  switch (sort) {
    case 'price_asc':
      return { 'variants.0.price': 1 };
    case 'price_desc':
      return { 'variants.0.price': -1 };
    case 'newest':
      return { createdAt: -1 };
    case 'popular':
      return { totalSold: -1 };
    case 'rating':
      return { averageRating: -1 };
    case 'name':
      return { name: 1 };
    default:
      return { isFeatured: -1, createdAt: -1 };
  }
}

async function resolveStoreAdminScope(userRole: string, userStoreId?: string, userId?: string): Promise<string | undefined> {
  if (userRole !== 'storeAdmin') return userStoreId;
  if (userStoreId) return userStoreId;
  if (!userId) return undefined;

  const ownedStore = await Store.findOne({ adminId: userId }).select('_id').lean();
  return ownedStore?._id?.toString();
}

// ─── Public Services ─────────────────────────────────────────────────────

/**
 * Returns a paginated, filterable list of active products.
 *
 * @param query - Parsed query params: category, store/storeId, search,
 *                minPrice, maxPrice, page, limit, sort, isFeatured
 * @param userStoreId - Currently selected store from auth context (optional)
 */
export async function getProducts(
  query: Record<string, any>,
  userStoreId?: string,
): Promise<PaginatedResponse<IProduct>> {
  const { page, limit, skip } = parsePagination(query);

  const filter: any = { isActive: true };

  // Store filter (query param takes precedence over user's selected store)
  const storeId = query.storeId || query.store || userStoreId;
  if (storeId) {
    // Products with no store assignment are treated as global and should be visible in every store context.
    filter.$or = [{ storeId }, { storeId: { $size: 0 } }];
  }

  // Category filter (by slug or ID)
  if (query.category) {
    if (mongoose.Types.ObjectId.isValid(query.category)) {
      filter.category = query.category;
    } else {
      const cat = await Category.findOne({ slug: query.category, isActive: true });
      if (cat) filter.category = cat._id;
    }
  }

  // Full-text search
  if (query.search || query.q) {
    const searchTerm = query.search || query.q;
    filter.$text = { $search: searchTerm };
  }

  // Price range filter (checks first variant's price)
  if (query.minPrice || query.maxPrice) {
    filter['variants.price'] = {};
    if (query.minPrice) filter['variants.price'].$gte = Number(query.minPrice);
    if (query.maxPrice) filter['variants.price'].$lte = Number(query.maxPrice);
  }

  // Featured filter
  if (query.isFeatured === 'true') {
    filter.isFeatured = true;
  }

  const sortOptions = buildSortOptions(query.sort);

  // Add text score if doing text search
  let findQuery = Product.find(filter);
  if (filter.$text) {
    findQuery = findQuery.select({ score: { $meta: 'textScore' } } as any);
    if (!query.sort) {
      // Default to relevance sort for text search
      (sortOptions as any).score = { $meta: 'textScore' };
    }
  }

  const [products, total] = await Promise.all([
    findQuery
      .select('name slug shortDescription images variants tags averageRating reviewCount isFeatured totalSold category storeId')
      .populate('category', 'name slug')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return createPaginationResponse(products, total, page, limit);
}

/**
 * Full-text fuzzy search for products.
 * GET /api/products/search?q=imidacloprid
 *
 * @param searchQuery - The search string
 * @param storeId - Optional store filter
 * @param limit - Max results (default 10)
 */
export async function searchProducts(
  searchQuery: string,
  storeId?: string,
  limit = 10,
): Promise<IProduct[]> {
  const filter: any = {
    isActive: true,
    $text: { $search: searchQuery },
  };

  if (storeId) {
    filter.$or = [{ storeId }, { storeId: { $size: 0 } }];
  }

  return Product.find(filter, { score: { $meta: 'textScore' } })
    .select('name slug shortDescription images variants.label variants.price tags')
    .populate('category', 'name slug')
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit);
}

/**
 * Fetches a single product by slug with full details.
 * Includes reviews (approved only).
 *
 * @param slug - The product's URL slug
 */
export async function getProductBySlug(slug: string): Promise<{
  product: IProduct;
  reviews: any[];
}> {
  const product = await Product.findOne({ slug, isActive: true })
    .populate('category', 'name slug')
    .populate('storeId', 'name address');

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  const reviews = await Review.find({ productId: product._id, isApproved: true })
    .populate('userId', 'name')
    .sort({ createdAt: -1 })
    .limit(20);

  return { product, reviews };
}

// ─── Admin Services ──────────────────────────────────────────────────────

/**
 * Returns products for admin panel with role-based filtering.
 * - storeAdmin: only their store's products
 * - superAdmin: all products
 *
 * @param query - Pagination/filter query
 * @param userRole - Current user's role
 * @param userStoreId - Current user's store ID (for storeAdmin)
 */
export async function getAdminProducts(
  query: Record<string, any>,
  userRole: string,
  userStoreId?: string,
  userId?: string,
): Promise<PaginatedResponse<IProduct>> {
  const { page, limit, skip } = parsePagination(query);

  const filter: any = {};
  const resolvedStoreId = await resolveStoreAdminScope(userRole, userStoreId, userId);

  // Store admins only see their store's products
  if (userRole === 'storeAdmin') {
    if (!resolvedStoreId) {
      return createPaginationResponse([], 0, page, limit);
    }
    filter.storeId = resolvedStoreId;
  }

  // Optional filters
  if (query.category) filter.category = query.category;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { tags: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('storeId', 'name')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return createPaginationResponse(products, total, page, limit);
}

export async function getAdminProductById(
  id: string,
  userRole: string,
  userStoreId?: string,
  userId?: string,
): Promise<IProduct> {
  const resolvedStoreId = await resolveStoreAdminScope(userRole, userStoreId, userId);
  const product = await Product.findById(id)
    .populate('category', 'name slug')
    .populate('storeId', 'name');

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  if (userRole === 'storeAdmin') {
    const hasAccess = resolvedStoreId ? product.storeId.some((sid) => sid.toString() === resolvedStoreId) : false;
    if (!hasAccess) {
      throw new AppError('You can only access products in your store', 403);
    }
  }

  return product;
}

/**
 * Creates a new product with image uploads.
 *
 * @param input - Product data
 * @param files - Multer files (up to 5 images)
 * @param userRole - Current user's role
 * @param userStoreId - Current user's store ID
 */
export async function createProduct(
  input: CreateProductInput,
  files: Express.Multer.File[],
  userRole: string,
  userStoreId?: string,
  userId?: string,
): Promise<IProduct> {
  const slug = await ensureUniqueSlug(slugify(input.name));
  const imageUrls = Array.isArray(input.imageUrls)
    ? input.imageUrls.map((url) => url.trim()).filter(Boolean)
    : [];

  // Handle store assignment
  let storeIds: string[] = [];
  const resolvedStoreId = await resolveStoreAdminScope(userRole, userStoreId, userId);
  if (userRole === 'storeAdmin' && resolvedStoreId) {
    // Store admin: auto-assign to their store
    storeIds = [resolvedStoreId];
  } else if (userRole === 'storeAdmin') {
    throw new AppError('No store is assigned to this admin account. Please contact super admin.', 400);
  } else if (input.storeId) {
    // Super admin can assign to specific stores
    storeIds = Array.isArray(input.storeId) ? input.storeId : [input.storeId];
  } else {
    // If no explicit store is passed by super admin, assign to all active stores.
    const activeStores = await Store.find({ isActive: true }).select('_id').lean();
    storeIds = activeStores.map((store) => store._id.toString());
  }

  // Upload images to Cloudinary
  let images: Array<{ url: string; publicId: string; isPrimary: boolean }> = [];
  const totalIncomingImages = (files?.length || 0) + imageUrls.length;
  if (totalIncomingImages > 5) {
    throw new AppError('Maximum 5 images allowed (files + image URLs)', 400);
  }

  if (totalIncomingImages > 0) {
    const [uploadedFromFiles, uploadedFromUrls] = await Promise.all([
      files && files.length > 0
        ? uploadMultipleToCloudinary(files, 'vaniki/products', 5)
        : Promise.resolve([]),
      imageUrls.length > 0
        ? Promise.all(imageUrls.map((url) => uploadImageUrlToCloudinary(url, 'vaniki/products')))
        : Promise.resolve([]),
    ]);

    images = [...uploadedFromFiles, ...uploadedFromUrls].map((img, idx) => ({
      ...img,
      isPrimary: idx === 0,
    }));
  }

  const product = await Product.create({
    name: input.name,
    slug,
    description: input.description,
    shortDescription: input.shortDescription,
    category: input.category,
    storeId: storeIds,
    variants: input.variants,
    tags: input.tags || [],
    isFeatured: input.isFeatured || false,
    metaTitle: input.metaTitle,
    metaDescription: input.metaDescription,
    images,
  });

  await invalidateHomepageCache(storeIds);
  return product.populate([
    { path: 'category', select: 'name slug' },
    { path: 'storeId', select: 'name' },
  ]);
}

/**
 * Updates an existing product.
 *
 * @param id - Product ObjectId
 * @param input - Fields to update
 * @param files - Optional new images to append
 * @param userRole - Current user's role
 * @param userStoreId - Current user's store ID
 */
export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  files: Express.Multer.File[],
  userRole: string,
  userStoreId?: string,
  userId?: string,
): Promise<IProduct> {
  const resolvedStoreId = await resolveStoreAdminScope(userRole, userStoreId, userId);
  const product = await Product.findById(id);
  if (!product) {
    throw new AppError('Product not found', 404);
  }
  const imageUrls = Array.isArray(input.imageUrls)
    ? input.imageUrls.map((url) => url.trim()).filter(Boolean)
    : [];

  // Store admins can only edit their store's products
  if (userRole === 'storeAdmin') {
    const hasAccess = product.storeId.some(
      (sid) => sid.toString() === resolvedStoreId,
    );
    if (!hasAccess) {
      throw new AppError('You can only edit products in your store', 403);
    }
  }

  // Update slug if name changed
  if (input.name && input.name !== product.name) {
    product.slug = await ensureUniqueSlug(slugify(input.name), id);
  }

  if (input.removedImagePublicIds?.length) {
    for (const publicId of input.removedImagePublicIds) {
      const existing = product.images.find((image) => image.publicId === publicId);
      if (existing) {
        await deleteFromCloudinary(existing.publicId);
      }
    }
    product.images = product.images.filter(
      (image) => !input.removedImagePublicIds?.includes(image.publicId),
    ) as any;
  }

  if (input.existingImages?.length) {
    const imageMap = new Map(product.images.map((image) => [image.publicId, image]));
    product.images = input.existingImages
      .map((image) => imageMap.get(image.publicId))
      .filter(Boolean) as any;
  }

  // Upload new images (append to existing)
  if ((files && files.length > 0) || imageUrls.length > 0) {
    const totalImages = product.images.length + (files?.length || 0) + imageUrls.length;
    if (totalImages > 5) {
      throw new AppError(
        `Cannot exceed 5 images. Current: ${product.images.length}, Uploading: ${(files?.length || 0) + imageUrls.length}`,
        400,
      );
    }

    const [uploadedFromFiles, uploadedFromUrls] = await Promise.all([
      files && files.length > 0
        ? uploadMultipleToCloudinary(files, 'vaniki/products', 5)
        : Promise.resolve([]),
      imageUrls.length > 0
        ? Promise.all(imageUrls.map((url) => uploadImageUrlToCloudinary(url, 'vaniki/products')))
        : Promise.resolve([]),
    ]);

    const newImages = [...uploadedFromFiles, ...uploadedFromUrls].map((img) => ({
      ...img,
      isPrimary: false,
    }));

    product.images.push(...newImages);
  }

  // Update scalar fields
  if (input.name !== undefined) product.name = input.name;
  if (input.description !== undefined) product.description = input.description;
  if (input.shortDescription !== undefined) product.shortDescription = input.shortDescription;
  if (input.category !== undefined) product.category = input.category as any;
  if (input.variants !== undefined) product.variants = input.variants as any;
  if (input.tags !== undefined) product.tags = input.tags as any;
  if (input.isActive !== undefined) product.isActive = input.isActive;
  if (input.isFeatured !== undefined) product.isFeatured = input.isFeatured;
  if (input.metaTitle !== undefined) product.metaTitle = input.metaTitle;
  if (input.metaDescription !== undefined) product.metaDescription = input.metaDescription;

  // Store assignment (only super admin can change stores)
  if (userRole === 'superAdmin') {
    if (input.storeId !== undefined) {
      product.storeId = (Array.isArray(input.storeId) ? input.storeId : [input.storeId]) as any;
    } else if (!product.storeId.length) {
      // Backfill older globally-unassigned products when edited in super admin.
      const activeStores = await Store.find({ isActive: true }).select('_id').lean();
      product.storeId = activeStores.map((store) => store._id) as any;
    }
  }

  if (product.images.length > 0) {
    const primaryImagePublicId =
      input.primaryImagePublicId ||
      product.images.find((image) => image.isPrimary)?.publicId ||
      product.images[0]?.publicId;
    product.images = product.images.map((image) => ({
      ...image,
      isPrimary: image.publicId === primaryImagePublicId,
    })) as any;
  }

  await product.save();
  await invalidateHomepageCache(product.storeId.map(id => id.toString()));

  return product.populate([
    { path: 'category', select: 'name slug' },
    { path: 'storeId', select: 'name' },
  ]);
}

/**
 * Soft-deletes a product.
 *
 * @param id - Product ObjectId
 * @param userRole - Current user's role
 * @param userStoreId - Current user's store ID
 */
export async function deleteProduct(
  id: string,
  userRole: string,
  userStoreId?: string,
  userId?: string,
): Promise<IProduct> {
  const resolvedStoreId = await resolveStoreAdminScope(userRole, userStoreId, userId);
  const product = await Product.findById(id);
  if (!product) {
    throw new AppError('Product not found', 404);
  }

  // Store admins can only delete their store's products
  if (userRole === 'storeAdmin') {
    const hasAccess = product.storeId.some(
      (sid) => sid.toString() === resolvedStoreId,
    );
    if (!hasAccess) {
      throw new AppError('You can only delete products in your store', 403);
    }
  }

  product.isActive = false;
  await product.save();
  await invalidateHomepageCache(product.storeId.map(id => id.toString()));
  return product;
}
