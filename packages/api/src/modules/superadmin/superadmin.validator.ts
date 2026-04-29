import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const optionalObjectIdFromEmpty = z.preprocess(
  (value) => (value === '' ? null : value),
  objectIdSchema.optional().nullable(),
);

const boolish = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return value;
}, z.boolean());

const numberFromInput = (schema: z.ZodNumber, fallback?: number) =>
  z.preprocess((value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') return Number(value);
    return fallback ?? value;
  }, schema);

const emptyToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
};

export const analyticsQuerySchema = z.object({
  query: z.object({
    range: z.preprocess(emptyToUndefined, z.enum(['30d', '60d', '90d']).optional()),
  }),
});

const storeSchema = z.object({
  name: z.string().trim().min(2).max(150),
  address: z.object({
    street: z.string().trim().min(3),
    city: z.string().trim().min(2),
    state: z.string().trim().min(2),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Invalid pincode'),
  }),
  phone: z.string().trim().min(10).max(15),
  email: z.string().trim().email().optional().or(z.literal('')),
  adminId: objectIdSchema,
  location: z.object({
    type: z.literal('Point').default('Point'),
    coordinates: z.array(z.number()).length(2),
  }),
  deliveryRadius: numberFromInput(z.number().min(0), 10).default(10),
  openHours: z
    .object({
      monday: z.string().trim().max(80).optional(),
      tuesday: z.string().trim().max(80).optional(),
      wednesday: z.string().trim().max(80).optional(),
      thursday: z.string().trim().max(80).optional(),
      friday: z.string().trim().max(80).optional(),
      saturday: z.string().trim().max(80).optional(),
      sunday: z.string().trim().max(80).optional(),
    })
    .optional(),
  isActive: boolish.optional(),
});

export const createStoreSchema = z.object({
  body: storeSchema,
});

export const updateStoreSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: storeSchema.partial(),
});

export const toggleStoreSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({ isActive: boolish }),
});

export const reassignStoreAdminSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({ adminId: objectIdSchema }),
});

export const deleteStoreSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});

const createAdminBodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().optional().or(z.literal('')),
  mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Invalid mobile number'),
  password: z.string().min(6).max(128),
  storeId: objectIdSchema.optional(),
  storeName: z.string().trim().min(2).max(150),
  storeLocation: z.string().trim().min(3).max(250),
  longitude: numberFromInput(z.number().min(-180).max(180)),
  latitude: numberFromInput(z.number().min(-90).max(90)),
  gstNumber: z.string().trim().toUpperCase().regex(GSTIN_PATTERN, 'Invalid GST number'),
  sgstNumber: z.string().trim().toUpperCase().regex(GSTIN_PATTERN, 'Invalid SGST number'),
}).refine((value) => value.gstNumber.slice(0, 2) === value.sgstNumber.slice(0, 2), {
  message: 'SGST state code must match GST state code',
  path: ['sgstNumber'],
});

export const createAdminSchema = z.object({
  body: createAdminBodySchema,
});

export const updateAdminSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      name: z.string().trim().min(2).max(100).optional(),
      email: z.string().trim().email().optional().or(z.literal('')),
      mobile: z.string().trim().regex(/^[6-9]\d{9}$/, 'Invalid mobile number').optional(),
      password: z.string().min(6).max(128).optional(),
      isActive: boolish.optional(),
      approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
      storeId: objectIdSchema.optional().nullable(),
      storeName: z.string().trim().min(2).max(150).optional(),
      storeLocation: z.string().trim().min(3).max(250).optional(),
      longitude: numberFromInput(z.number().min(-180).max(180)).optional(),
      latitude: numberFromInput(z.number().min(-90).max(90)).optional(),
      gstNumber: z.string().trim().toUpperCase().regex(GSTIN_PATTERN, 'Invalid GST number').optional(),
      sgstNumber: z.string().trim().toUpperCase().regex(GSTIN_PATTERN, 'Invalid SGST number').optional(),
    })
    .refine(
      (value) => {
        if (!value.gstNumber || !value.sgstNumber) return true;
        return value.gstNumber.slice(0, 2) === value.sgstNumber.slice(0, 2);
      },
      {
        message: 'SGST state code must match GST state code',
        path: ['sgstNumber'],
      },
    )
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one field is required',
    }),
});

export const approveAdminSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    approvalStatus: z.enum(['approved', 'rejected']),
  }),
});

export const customerQuerySchema = z.object({
  query: z.object({
    search: z.preprocess(emptyToUndefined, z.string().optional()),
    page: z.preprocess(emptyToUndefined, z.string().optional()),
    limit: z.preprocess(emptyToUndefined, z.string().optional()),
  }),
});

export const orderQuerySchema = z.object({
  query: z.object({
    search: z.preprocess(emptyToUndefined, z.string().optional()),
    storeId: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    status: z.preprocess(
      emptyToUndefined,
      z.enum(['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
    ),
    paymentStatus: z.preprocess(emptyToUndefined, z.enum(['pending', 'paid', 'failed', 'refunded']).optional()),
    paymentMethod: z.preprocess(emptyToUndefined, z.enum(['razorpay', 'cod']).optional()),
    startDate: z.preprocess(emptyToUndefined, z.string().optional()),
    endDate: z.preprocess(emptyToUndefined, z.string().optional()),
    page: z.preprocess(emptyToUndefined, z.string().optional()),
    limit: z.preprocess(emptyToUndefined, z.string().optional()),
  }),
});

export const orderStatusUpdateSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    status: z.enum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
    note: z.string().trim().max(200).optional(),
  }),
});

export const paymentQuerySchema = z.object({
  query: z.object({
    search: z.preprocess(emptyToUndefined, z.string().optional()),
    storeId: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    method: z.preprocess(emptyToUndefined, z.enum(['razorpay', 'cod']).optional()),
    status: z.preprocess(emptyToUndefined, z.enum(['pending', 'captured', 'failed', 'refunded']).optional()),
    startDate: z.preprocess(emptyToUndefined, z.string().optional()),
    endDate: z.preprocess(emptyToUndefined, z.string().optional()),
    page: z.preprocess(emptyToUndefined, z.string().optional()),
    limit: z.preprocess(emptyToUndefined, z.string().optional()),
  }),
});

export const productRequestQuerySchema = z.object({
  query: z.object({
    search: z.preprocess(emptyToUndefined, z.string().optional()),
    storeId: z.preprocess(emptyToUndefined, objectIdSchema.optional()),
    status: z.preprocess(emptyToUndefined, z.enum(['pending', 'contacted', 'fulfilled', 'rejected']).optional()),
    page: z.preprocess(emptyToUndefined, z.string().optional()),
    limit: z.preprocess(emptyToUndefined, z.string().optional()),
  }),
});

export const updateProductRequestStatusSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    status: z.enum(['pending', 'contacted', 'fulfilled', 'rejected']).optional(),
    superAdminNote: z.string().trim().max(400).optional(),
  }),
});

const testimonialSchema = z.object({
  name: z.string().trim().min(2).max(100),
  designation: z.string().trim().max(100).optional(),
  message: z.string().trim().min(10).max(1000),
  rating: numberFromInput(z.number().int().min(1).max(5)),
  avatarUrl: z.string().trim().url('Invalid avatar URL').optional(),
  storeId: optionalObjectIdFromEmpty,
  sortOrder: numberFromInput(z.number().int().min(0), 0).optional(),
  isActive: boolish.optional(),
});

export const createTestimonialSchema = z.object({
  body: testimonialSchema,
});

export const updateTestimonialSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: testimonialSchema.partial(),
});

export const toggleTestimonialSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({ isActive: boolish }),
});

export const reorderTestimonialsSchema = z.object({
  body: z.object({
    testimonials: z.array(
      z.object({
        id: objectIdSchema,
        sortOrder: z.number().int().min(0),
      }),
    ),
  }),
});

export const updateSiteSettingsSchema = z.object({
  body: z
    .object({
      platformName: z.string().trim().min(2).max(120).optional(),
      supportEmail: z.string().trim().email().optional().or(z.literal('')),
      supportPhone: z.string().trim().min(10).max(15).optional().or(z.literal('')),
      maintenanceMode: boolish.optional(),
      homepageHeadline: z.string().trim().max(220).optional(),
      defaultDeliveryRadius: numberFromInput(z.number().min(0)).optional(),
      freeDeliveryThreshold: numberFromInput(z.number().min(0)).optional(),
      standardDeliveryCharge: numberFromInput(z.number().min(0)).optional(),
      allowGuestCheckout: boolish.optional(),
      metaTitle: z.string().trim().max(160).optional(),
      metaDescription: z.string().trim().max(300).optional(),
      loyaltyPointRupeeValue: numberFromInput(z.number().min(0)).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'At least one setting is required',
    }),
});

export const updateStoreSecretsSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({
    secrets: z.record(z.string().min(1), z.union([z.string().min(1), z.null()])),
  }),
});

export function validate(schema: z.ZodObject<any>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      req.body = parsed.body;
      if (parsed.query && req.query && typeof req.query === 'object') {
        Object.assign(req.query as Record<string, unknown>, parsed.query as Record<string, unknown>);
      }
      if (parsed.params && req.params && typeof req.params === 'object') {
        Object.assign(req.params as Record<string, unknown>, parsed.params as Record<string, unknown>);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.issues.map((issue) => `${issue.path.slice(1).join('.')}: ${issue.message}`).join(', ');
        next(new AppError(message, 400));
      } else {
        next(error);
      }
    }
  };
}
