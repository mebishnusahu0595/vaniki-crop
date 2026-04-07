import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

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
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
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
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
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
