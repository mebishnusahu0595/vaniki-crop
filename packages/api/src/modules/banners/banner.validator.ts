import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

function parseOptionalDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00.000Z`)
    : new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const optionalDateSchema = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  return value;
}, z.string()
  .trim()
  .refine((value) => parseOptionalDateInput(value) !== null, { message: 'Invalid date' })
  .transform((value) => parseOptionalDateInput(value)!.toISOString())
  .optional());

const linkedProductSchema = z.object({
  productId: objectIdSchema,
  position: z.number().int().min(0).optional().default(0),
});

const optionalStoreIdSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  objectIdSchema.optional().nullable(),
);

const bannerSchema = z.object({
  title: z.string().trim().min(3).max(150),
  subtitle: z.string().trim().max(300).optional(),
  ctaText: z.string().trim().max(50).optional(),
  ctaLink: z.string().trim().optional(),
  imageUrl: z.string().trim().url('Invalid image URL').optional(),
  linkedProducts: z.string().optional(), // Expected as JSON string from multipart/form-data
  storeId: optionalStoreIdSchema,
  sortOrder: z.preprocess((val) => Number(val), z.number().int().default(0)),
  startDate: optionalDateSchema,
  endDate: optionalDateSchema,
  isActive: z.preprocess((val) => val === 'true', z.boolean().default(true)),
});

export const createBannerSchema = z.object({
  body: bannerSchema,
});

export const updateBannerSchema = z.object({
  body: bannerSchema.partial(),
  params: z.object({
    id: objectIdSchema,
  }),
});

export const reorderBannersSchema = z.object({
  body: z.object({
    banners: z.array(
      z.object({
        id: objectIdSchema,
        sortOrder: z.number().int().min(0),
      })
    ),
  }),
});

/**
 * Standardized Zod validator middleware for banners.
 */
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
