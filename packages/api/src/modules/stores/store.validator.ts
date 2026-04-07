import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const storeSchema = z.object({
  name: z.string().trim().min(3).max(150),
  address: z.object({
    street: z.string().trim().min(5),
    city: z.string().trim().min(2),
    state: z.string().trim().min(2),
    pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode'),
  }),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal('')),
  adminId: objectIdSchema,
  location: z.object({
    type: z.literal('Point'),
    coordinates: z.array(z.number()).length(2), // [lng, lat]
  }),
  openHours: z.object({
    monday: z.string().optional(),
    tuesday: z.string().optional(),
    wednesday: z.string().optional(),
    thursday: z.string().optional(),
    friday: z.string().optional(),
    saturday: z.string().optional(),
    sunday: z.string().optional(),
  }).optional(),
  deliveryRadius: z.number().min(0).optional(),
});

export const createStoreSchema = z.object({
  body: storeSchema,
});

export const updateStoreSchema = z.object({
  body: storeSchema.partial(),
  params: z.object({
    id: objectIdSchema,
  }),
});

export const updateOwnStoreSchema = z.object({
  body: storeSchema.omit({ adminId: true }).partial(),
});

/**
 * Zod validator middleware factory.
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
