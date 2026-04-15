import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const orderItemSchema = z.object({
  productId: objectIdSchema,
  variantId: z.string().min(1, 'Variant ID is required'),
  qty: z.number().int().min(1, 'Quantity must be at least 1'),
});
const shippingAddressSchema = z.object({
  name: z.string().trim().min(2),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid mobile number'),
  street: z.string().trim().min(5),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode'),
});

const orderRequestBodySchema = z
  .object({
    storeId: objectIdSchema.optional(),
    serviceMode: z.enum(['delivery', 'pickup']),
    items: z.array(orderItemSchema).min(1, 'At least one item is required'),
    couponCode: z.string().trim().toUpperCase().optional(),
    shippingAddress: shippingAddressSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.serviceMode === 'pickup' && !value.storeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['storeId'],
        message: 'Pickup orders require a store selection',
      });
    }
  });

/**
 * Zod schema for initiating an order.
 */
export const initiateOrderSchema = z.object({
  body: orderRequestBodySchema,
});

/**
 * Zod schema for placing a COD order.
 */
export const placeCodOrderSchema = initiateOrderSchema;

/**
 * Zod schema for confirming an order.
 */
export const confirmOrderSchema = z.object({
  body: z
    .object({
      razorpayOrderId: z.string().min(1, 'Razorpay Order ID is required'),
      razorpayPaymentId: z.string().min(1, 'Razorpay Payment ID is required'),
      razorpaySignature: z.string().min(1, 'Razorpay Signature is required'),
      // These must match the initial request for verification and DB save
      storeId: objectIdSchema.optional(),
      serviceMode: z.enum(['delivery', 'pickup']),
      items: z.array(
        z.object({
          productId: objectIdSchema,
          variantId: z.string().min(1),
          qty: z.number().int().min(1),
        })
      ).min(1),
      couponCode: z.string().trim().toUpperCase().optional(),
      shippingAddress: z.object({
        name: z.string().trim(),
        mobile: z.string(),
        street: z.string(),
        city: z.string(),
        state: z.string(),
        pincode: z.string(),
      }).optional(),
    })
    .superRefine((value, ctx) => {
      if (value.serviceMode === 'pickup' && !value.storeId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['storeId'],
          message: 'Pickup orders require a store selection',
        });
      }
    }),
});

/**
 * Zod schema for admin status update.
 */
export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
    note: z.string().trim().max(200).optional(),
  }),
  params: z.object({
    id: objectIdSchema,
  }),
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
