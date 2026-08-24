import type { Request, Response, NextFunction } from 'express';
import * as productService from './product.service.js';

// ─── Public Controllers ──────────────────────────────────────────────────

/**
 * GET /api/products
 * Paginated, filterable product list.
 * Query: category, store, storeId, search, minPrice, maxPrice, page, limit, sort
 */
export async function getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await productService.getProducts(req.query, req.storeId || req.userStoreId);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/products/search?q=...&storeId=...&limit=10
 * Full-text fuzzy search endpoint.
 */
export async function searchProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { q, storeId, limit } = req.query as any;
    const activeStoreId = storeId || req.storeId || req.userStoreId;
    const products = await productService.searchProducts(
      q,
      activeStoreId,
      limit ? parseInt(limit) : undefined,
    );
    res.status(200).json({
      success: true,
      data: products,
      total: products.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/products/:slug
 * Full product detail with variants, reviews.
 */
export async function getProductBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const storeId = req.storeId || req.userStoreId;
    const serviceMode = req.query.serviceMode as string | undefined;
    const { product, reviews } = await productService.getProductBySlug(req.params.slug as string, storeId, serviceMode);
    res.status(200).json({
      success: true,
      data: {
        ...product.toJSON(),
        reviews,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/products/bulk-catalogue
 * Public — returns all active products with MOQ for Dealer Play app.
 */
export async function getBulkCatalogue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await productService.getBulkCatalogue(req.query);
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

// ─── Admin Controllers ───────────────────────────────────────────────────

/**
 * GET /api/admin/products
 * Admin product list (own store for storeAdmin, all for superAdmin).
 */
export async function getAdminProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await productService.getAdminProducts(
      req.query,
      req.userRole!,
      req.userStoreId,
      req.userId,
    );
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/products/:id
 * Admin product detail.
 */
export async function getAdminProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productService.getAdminProductById(
      req.params.id as string,
      req.userRole!,
      req.userStoreId,
      req.userId,
    );
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/products
 * Create product with image upload (multipart).
 */
export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    const product = await productService.createProduct(
      req.body,
      files,
      req.userRole!,
      req.userStoreId,
      req.userId,
    );
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/admin/products/:id
 * Update product. Accepts new images (appended to existing).
 */
export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    const product = await productService.updateProduct(
      req.params.id as string,
      req.body,
      files,
      req.userRole!,
      req.userStoreId,
      req.userId,
    );
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/products/:id/deactivate
 * Soft delete (isActive: false).
 */
export async function deactivateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productService.deactivateProduct(
      req.params.id as string,
      req.userRole!,
      req.userStoreId,
      req.userId,
    );
    res.status(200).json({
      success: true,
      message: 'Product deactivated successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/products/:id
 * Permanent delete.
 */
export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productService.deleteProduct(
      req.params.id as string,
      req.userRole!,
      req.userStoreId,
      req.userId,
    );
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/products/:id/moq
 * SuperAdmin only: set minimum order quantity (MOQ) for dealer bulk ordering.
 */
export async function updateProductMoq(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await productService.updateProductMoq(
      req.params.id as string,
      req.body.moq,
      req.userRole!,
    );
    res.status(200).json({
      success: true,
      message: 'MOQ updated successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
}
