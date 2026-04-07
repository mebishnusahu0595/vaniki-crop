import type { Request, Response, NextFunction } from 'express';
import * as categoryService from './category.service.js';

// ─── Public Controllers ──────────────────────────────────────────────────

/**
 * GET /api/categories
 * Returns all active categories for the storefront.
 */
export async function getCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await categoryService.getActiveCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/categories/:slug
 * Returns a single category with its products (paginated).
 */
export async function getCategoryBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await categoryService.getCategoryBySlug(req.params.slug as string, req.query);
    res.status(200).json({
      success: true,
      data: {
        category: result.category,
        products: result.products.data,
        pagination: result.products.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Admin Controllers ───────────────────────────────────────────────────

/**
 * GET /api/admin/categories
 * Returns all categories (including inactive) with pagination.
 */
export async function getAdminCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await categoryService.getAllCategoriesAdmin(req.query);
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
 * POST /api/admin/categories
 * Creates a new category. Accepts optional image upload.
 */
export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const category = await categoryService.createCategory(
      req.body,
      req.file,
    );
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/admin/categories/:id
 * Updates an existing category. Accepts optional new image.
 */
export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const category = await categoryService.updateCategory(
      req.params.id as string,
      req.body,
      req.file,
    );
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/categories/:id/toggle-active
 * Activates/deactivates a category.
 */
export async function toggleCategoryActive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const category = await categoryService.toggleCategoryActive(
      req.params.id as string,
      req.body.isActive,
    );
    res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      data: category,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/categories/:id
 * Soft-deletes a category (sets isActive to false).
 */
export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const category = await categoryService.deleteCategory(req.params.id as string);
    res.status(200).json({
      success: true,
      message: 'Category deactivated successfully',
      data: category,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/categories/:id/permanent
 * Permanently deletes an inactive category with no linked products.
 */
export async function permanentlyDeleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await categoryService.permanentlyDeleteCategory(req.params.id as string);
    res.status(200).json({
      success: true,
      message: 'Category deleted permanently',
    });
  } catch (error) {
    next(error);
  }
}
