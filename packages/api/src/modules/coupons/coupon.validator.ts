import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

function parseCouponExpiryDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T23:59:59.999Z`)
    : new Date(trimmed);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const couponExpiryDateSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => parseCouponExpiryDate(value) !== null, {
    message: 'Invalid expiry date',
  })
  .transform((value) => parseCouponExpiryDate(value)!.toISOString())
  .refine((value) => new Date(value).getTime() > Date.now(), {
    message: 'Expiry date must be in the future',
  });

const createCouponSchema = z.object({
  body: z.object({
    code: z.string().trim().min(3).max(30).toUpperCase(),
    type: z.enum(['percent', 'flat']),
    value: z.number().positive(),
    minOrderAmount: z.number().min(0).default(0),
    maxDiscount: z.number().min(0).optional(),
    usageLimit: z.number().int().min(1),
    perUserLimit: z.number().int().min(1).default(1),
    expiryDate: couponExpiryDateSchema,
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

export { createCouponSchema, validateCouponSchema };
