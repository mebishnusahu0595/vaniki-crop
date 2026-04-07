import type { Request, Response, NextFunction } from 'express';
import { Product } from '../models/Product.model.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Fetches all active products with pagination, search, and category filtering.
 * GET /api/products
 * @param req - Express request with optional query params: page, limit, search, category
 * @param res - Express response
 * @param next - Express next function
 */
export async function getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;
    const { search, category } = req.query;

    const filter: Record<string, any> = { isActive: true };
    if (category) filter.category = category;
    if (search) filter.$text = { $search: search as string };

    const [products, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetches a single product by its slug.
 * GET /api/products/:slug
 * @param req - Express request with slug param
 * @param res - Express response
 * @param next - Express next function
 */
export async function getProductBySlug(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const product = await Product.findOne({ slug: req.params.slug, isActive: true });
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

/**
 * Creates a new product (admin only).
 * POST /api/products
 * @param req - Express request with product data in body
 * @param res - Express response
 * @param next - Express next function
 */
export async function createProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates an existing product by ID (admin only).
 * PUT /api/products/:id
 * @param req - Express request with product ID param and update data in body
 * @param res - Express response
 * @param next - Express next function
 */
export async function updateProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

/**
 * Soft-deletes a product by setting isActive to false (admin only).
 * DELETE /api/products/:id
 * @param req - Express request with product ID param
 * @param res - Express response
 * @param next - Express next function
 */
export async function deleteProduct(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    res.status(200).json({ success: true, message: 'Product deactivated' });
  } catch (error) {
    next(error);
  }
}
