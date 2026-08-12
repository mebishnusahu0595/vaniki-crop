import { z } from 'zod';
import type { NextFunction, Request, Response } from 'express';

// ─── Section Schema ───────────────────────────────────────────────────────

const cropSectionSchema = z.object({
  title: z.string().trim().min(1, 'Section title is required'),
  body: z.string().min(1, 'Section body is required'),
  sortOrder: z.coerce.number().default(0),
});

// ─── Create Crop ─────────────────────────────────────────────────────────

export const createCropSchema = z.object({
  name: z.string().trim().min(1, 'Crop name is required').max(150),
  shortDescription: z.string().trim().min(1, 'Short description is required').max(400),
  description: z.string().optional().default(''),
  sections: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
      return val ?? [];
    }, z.array(cropSectionSchema))
    .optional()
    .default([]),
  suggestedProductIds: z
    .preprocess((val) => {
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
      return val ?? [];
    }, z.array(z.string()))
    .optional()
    .default([]),
  isActive: z
    .preprocess((val) => {
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return true;
    }, z.boolean())
    .default(true),
  sortOrder: z.coerce.number().default(0),
});

export type CreateCropInput = z.output<typeof createCropSchema>;

// ─── Update Crop ─────────────────────────────────────────────────────────

export const updateCropSchema = createCropSchema.partial();
export type UpdateCropInput = z.output<typeof updateCropSchema>;

// ─── Toggle Active ────────────────────────────────────────────────────────

export const toggleCropSchema = z.object({
  isActive: z.boolean(),
});

// ─── Validation Middleware ────────────────────────────────────────────────

export function validate<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      res.status(400).json({
        success: false,
        error: firstIssue?.message || 'Validation failed',
        details: result.error.issues,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
