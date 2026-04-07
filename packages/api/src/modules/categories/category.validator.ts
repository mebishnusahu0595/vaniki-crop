import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';

// ─── Reusable Fields ─────────────────────────────────────────────────────

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const boolish = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return value;
}, z.boolean());

// ─── Schemas ─────────────────────────────────────────────────────────────

/**
 * Zod schema for creating a category.
 * POST /api/admin/categories
 */
export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional(),
    imageUrl: z.string().trim().url('Invalid image URL').optional(),
    parentCategory: objectIdSchema.nullable().optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
    isActive: boolish.optional(),
  }),
});

/**
 * Zod schema for updating a category.
 * PUT /api/admin/categories/:id
 */
export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    imageUrl: z.string().trim().url('Invalid image URL').optional(),
    parentCategory: objectIdSchema.nullable().optional(),
    isActive: boolish.optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

export const toggleCategorySchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({ isActive: boolish }),
});

/**
 * Zod schema for slug parameter.
 * GET /api/categories/:slug
 */
export const categorySlugSchema = z.object({
  params: z.object({
    slug: z.string().trim().min(1),
  }),
});

/**
 * Zod schema for ID parameter.
 */
export const categoryIdSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

// ─── Types ───────────────────────────────────────────────────────────────

export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];

// ─── Validate Middleware ─────────────────────────────────────────────────

/** Validates request against a Zod schema */
export function validate(schema: z.ZodObject<any>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = parsed.body ?? req.body;
      if (parsed.query && req.query && typeof req.query === 'object') {
        Object.assign(req.query as Record<string, unknown>, parsed.query as Record<string, unknown>);
      }
      if (parsed.params && req.params && typeof req.params === 'object') {
        Object.assign(req.params as Record<string, unknown>, parsed.params as Record<string, unknown>);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = (error as any).issues
          .map((e: any) => `${e.path.slice(1).join('.')}: ${e.message}`)
          .join(', ');
        next(new AppError(message, 400));
      } else {
        next(error);
      }
    }
  };
}
