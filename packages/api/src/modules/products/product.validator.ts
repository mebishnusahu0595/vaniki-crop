import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';

function parseJsonField<T>(raw: string, fieldName: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new AppError(`Invalid JSON format for ${fieldName}`, 400);
  }
}

// ─── Reusable Fields ─────────────────────────────────────────────────────

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const requiredNumber = (label: string) =>
  z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }

      const numericValue = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(numericValue) ? numericValue : undefined;
    },
    z.number({
      message: `${label} is required`,
    }),
  );

const variantSchema = z.object({
  label: z.string().trim().min(1, 'Variant label is required'),
  price: requiredNumber('Price').pipe(z.number().min(0, 'Price must be non-negative')),
  adminPrice: z.coerce.number().min(0, 'Admin price must be non-negative').optional(),
  mrp: requiredNumber('MRP').pipe(z.number().min(0, 'MRP must be non-negative')),
  stock: requiredNumber('Stock').pipe(z.number().int().min(0, 'Stock must be non-negative')),
  sku: z.string().trim().min(1, 'SKU is required').toUpperCase(),
});

const existingImageSchema = z.object({
  url: z.string().trim().url().or(z.string().trim().min(1)),
  publicId: z.string().trim().min(1),
  isPrimary: z.boolean().optional(),
});

const imageUrlsSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;

    if (Array.isArray(value)) return value;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;

      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // no-op: fallback parsing below
      }

      if (trimmed.includes(',') || trimmed.includes('\n')) {
        return trimmed
          .split(/[\n,]/)
          .map((entry) => entry.trim())
          .filter(Boolean);
      }

      return [trimmed];
    }

    return value;
  }, z.array(z.string().trim().url('Invalid image URL')).max(5, 'Maximum 5 image URLs allowed'))
  .optional();

// ─── Schemas ─────────────────────────────────────────────────────────────

/**
 * Zod schema for creating a product.
 * POST /api/admin/products
 */
export const createProductSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().min(10, 'Description must be at least 10 characters'),
    shortDescription: z.string().trim().min(5).max(300),
    category: objectIdSchema,
    storeId: z.union([objectIdSchema, z.array(objectIdSchema)]).optional(),
    variants: z.union([
      z.string().transform((val) => parseJsonField(val, 'variants')),
      z.array(variantSchema),
    ]).pipe(z.array(variantSchema).min(1, 'At least one variant is required')),
    tags: z.union([
      z.string().transform((val) => {
        try { return JSON.parse(val); } catch { return val.split(',').map((t: string) => t.trim()); }
      }),
      z.array(z.string()),
    ]).optional(),
    imageUrls: imageUrlsSchema,
    isFeatured: z.union([z.boolean(), z.string().transform(v => v === 'true')]).optional(),
    loyaltyPointEligible: z.union([z.boolean(), z.string().transform(v => v === 'true')]).optional(),
    maxLoyaltyPoints: z.coerce.number().min(0).optional(),
    metaTitle: z.string().trim().max(70).optional(),
    metaDescription: z.string().trim().max(160).optional(),
  }),
});

/**
 * Zod schema for updating a product.
 * PUT /api/admin/products/:id
 */
export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().min(10).optional(),
    shortDescription: z.string().trim().min(5).max(300).optional(),
    category: objectIdSchema.optional(),
    storeId: z.union([objectIdSchema, z.array(objectIdSchema)]).optional(),
    variants: z.union([
      z.string().transform((val) => parseJsonField(val, 'variants')),
      z.array(variantSchema),
    ]).pipe(z.array(variantSchema).min(1)).optional(),
    tags: z.union([
      z.string().transform((val) => {
        try { return JSON.parse(val); } catch { return val.split(',').map((t: string) => t.trim()); }
      }),
      z.array(z.string()),
    ]).optional(),
    imageUrls: imageUrlsSchema,
    isActive: z.union([z.boolean(), z.string().transform(v => v === 'true')]).optional(),
    isFeatured: z.union([z.boolean(), z.string().transform(v => v === 'true')]).optional(),
    loyaltyPointEligible: z.union([z.boolean(), z.string().transform(v => v === 'true')]).optional(),
    maxLoyaltyPoints: z.coerce.number().min(0).optional(),
    existingImages: z.union([
      z.string().transform((val) => parseJsonField(val, 'existingImages')),
      z.array(existingImageSchema),
    ]).pipe(z.array(existingImageSchema)).optional(),
    removedImagePublicIds: z.union([
      z.string().transform((val) => parseJsonField(val, 'removedImagePublicIds')),
      z.array(z.string()),
    ]).pipe(z.array(z.string())).optional(),
    primaryImagePublicId: z.string().trim().optional(),
    metaTitle: z.string().trim().max(70).optional(),
    metaDescription: z.string().trim().max(160).optional(),
  }),
  params: z.object({ id: objectIdSchema }),
});

/**
 * Zod schema for product listing query parameters.
 * GET /api/products
 */
export const productListQuerySchema = z.object({
  query: z.object({
    category: z.string().optional(),
    store: objectIdSchema.optional(),
    storeId: objectIdSchema.optional(),
    search: z.string().trim().optional(),
    q: z.string().trim().optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    sort: z.enum(['price_asc', 'price_desc', 'newest', 'popular', 'rating', 'name']).optional(),
    isFeatured: z.string().optional(),
  }),
});

/**
 * Zod schema for slug parameter.
 */
export const productSlugSchema = z.object({
  params: z.object({
    slug: z.string().trim().min(1),
  }),
});

/**
 * Zod schema for ID parameter.
 */
export const productIdSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

/**
 * Zod schema for search query.
 * GET /api/products/search?q=...
 */
export const searchQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().min(1, 'Search query is required'),
    storeId: objectIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});

// ─── Types ───────────────────────────────────────────────────────────────

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];

// ─── Validate Middleware ─────────────────────────────────────────────────

/** Validates request against a Zod schema (shared pattern) */
export function validate(schema: z.ZodObject<any>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body) req.body = parsed.body;
      if (parsed.query) Object.assign(req.query as any, parsed.query);
      if (parsed.params) Object.assign(req.params as any, parsed.params);
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
