import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const createCouponSchema = z.object({
  body: z.object({
    code: z.string().trim().min(3).max(30).toUpperCase(),
    type: z.enum(['percent', 'flat']),
    value: z.number().positive(),
    minOrderAmount: z.number().min(0).default(0),
    maxDiscount: z.number().min(0).optional(),
    usageLimit: z.number().int().min(1),
    expiryDate: z.string().datetime().refine((date) => new Date(date) > new Date(), {
      message: 'Expiry date must be in the future',
    }),
    applicableStores: z.array(objectIdSchema).optional().default([]),
  }).refine((data) => {
    if (data.type === 'percent' && data.value > 100) return false;
    return true;
  }, {
    message: 'Percentage discount cannot exceed 100%',
    path: ['value'],
  }),
});

const validateCouponSchema = z.object({
  body: z.object({
    code: z.string().trim().min(1).toUpperCase(),
    storeId: objectIdSchema,
    cartTotal: z.number().positive(),
  }),
});

/**
 * Standardized Zod validator middleware for coupons.
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

export { createCouponSchema, validateCouponSchema };
