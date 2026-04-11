import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';

// ─── Common ──────────────────────────────────────────────────────────────

const mobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number');

const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password cannot exceed 128 characters');

const otpSchema = z
  .string()
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d{6}$/, 'OTP must contain only digits');

// ─── Schemas ─────────────────────────────────────────────────────────────

/**
 * Zod schema for POST /api/auth/send-otp
 */
export const sendOtpSchema = z.object({
  body: z.object({
    mobile: mobileSchema,
  }),
});

/**
 * Zod schema for POST /api/auth/signup
 */
export const signupSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters'),
    email: z.string().trim().email('Please provide a valid email address').optional().or(z.literal('')),
    mobile: mobileSchema,
    password: passwordSchema,
    otp: otpSchema.optional(),
    referralCode: z
      .string()
      .trim()
      .min(4, 'Referral code must be at least 4 characters')
      .max(20, 'Referral code cannot exceed 20 characters')
      .regex(/^[A-Za-z0-9]+$/, 'Referral code can contain only letters and numbers')
      .optional(),
  }),
});

/**
 * Zod schema for POST /api/auth/dealer-signup
 */
export const dealerSignupSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters'),
    mobile: mobileSchema,
    email: z.string().trim().email('Please provide a valid email address').optional().or(z.literal('')),
    storeName: z.string().trim().min(2, 'Store name must be at least 2 characters').max(150),
    storeLocation: z.string().trim().min(3, 'Store location is required').max(250),
    longitude: z.coerce.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
    latitude: z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
    gstNumber: z.string().trim().min(5, 'GST number is required').max(30),
    sgstNumber: z.string().trim().min(5, 'SGST number is required').max(30),
    password: passwordSchema,
  }),
});

/**
 * Zod schema for POST /api/auth/login
 */
export const loginSchema = z.object({
  body: z.object({
    mobile: mobileSchema,
    password: passwordSchema,
  }),
});

/**
 * Zod schema for POST /api/auth/login-otp
 */
export const loginOtpSchema = z.object({
  body: z.object({
    mobile: mobileSchema,
    otp: otpSchema,
  }),
});

/**
 * Zod schema for POST /api/auth/forgot-password
 */
export const forgotPasswordSchema = z.object({
  body: z.object({
    mobile: mobileSchema,
  }),
});

/**
 * Zod schema for POST /api/auth/reset-password
 */
export const resetPasswordSchema = z.object({
  body: z.object({
    mobile: mobileSchema,
    otp: otpSchema,
    newPassword: passwordSchema,
  }),
});

/**
 * Zod schema for PATCH /api/auth/service-mode
 */
export const serviceModeSchema = z.object({
  body: z.object({
    serviceMode: z.enum(['delivery', 'pickup'], {
      message: 'Service mode must be "delivery" or "pickup"',
    }),
  }),
});

/**
 * Zod schema for PATCH /api/auth/selected-store
 */
export const selectedStoreSchema = z.object({
  body: z.object({
    storeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid store ID'),
  }),
});

/**
 * Zod schema for PATCH /api/auth/push-token
 */
export const pushTokenSchema = z.object({
  body: z.object({
    pushToken: z.string().trim().min(1, 'Push token is required'),
  }),
});

/**
 * Zod schema for PATCH /api/auth/me
 */
export const updateMeSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    email: z.string().trim().email('Please provide a valid email address').optional().or(z.literal('')),
    mobile: mobileSchema.optional(),
    savedAddress: z
      .object({
        street: z.string().trim().min(3, 'Street must be at least 3 characters').optional(),
        city: z.string().trim().min(2, 'City must be at least 2 characters').optional(),
        state: z.string().trim().min(2, 'State must be at least 2 characters').optional(),
        pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional(),
        landmark: z.string().trim().max(120, 'Landmark cannot exceed 120 characters').optional(),
      })
      .optional(),
  }),
});

/**
 * Zod schema for PATCH /api/auth/change-password
 */
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: passwordSchema,
    newPassword: passwordSchema,
  }),
});

/**
 * Zod schema for PATCH /api/auth/wishlist/toggle
 */
export const toggleWishlistSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  }),
});

// ─── Types ───────────────────────────────────────────────────────────────

export type SendOtpInput = z.infer<typeof sendOtpSchema>['body'];
export type SignupInput = z.infer<typeof signupSchema>['body'];
export type DealerSignupInput = z.infer<typeof dealerSignupSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type LoginOtpInput = z.infer<typeof loginOtpSchema>['body'];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>['body'];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>['body'];
export type ServiceModeInput = z.infer<typeof serviceModeSchema>['body'];
export type SelectedStoreInput = z.infer<typeof selectedStoreSchema>['body'];
export type PushTokenInput = z.infer<typeof pushTokenSchema>['body'];
export type UpdateMeInput = z.infer<typeof updateMeSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
export type ToggleWishlistInput = z.infer<typeof toggleWishlistSchema>['body'];



/**
 * Express middleware factory that validates request against a Zod schema.
 * Parses req.body, req.query, and req.params as defined in the schema.
 * @param schema - Zod schema with body/query/params shape
 * @returns Express middleware that validates and passes to next or returns 400
 */
export function validate(schema: z.ZodObject<any>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Override request with parsed (trimmed/cleaned) values
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
