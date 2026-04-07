import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError.js';

const mobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number');

const contactSubjectSchema = z.enum([
  'General Inquiry',
  'Product Query',
  'Order Issue',
  'Dealer Inquiry',
  'Other',
]);

export const createContactSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().email('Please provide a valid email address'),
    mobile: mobileSchema.optional(),
    subject: contactSubjectSchema,
    message: z.string().trim().min(20, 'Message must be at least 20 characters').max(2000),
  }),
});

export type CreateContactInput = z.infer<typeof createContactSchema>['body'];

export function validate(schema: z.ZodObject<any>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = parsed.body;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = (error as any).issues
          .map((issue: any) => `${issue.path.slice(1).join('.')}: ${issue.message}`)
          .join(', ');
        next(new AppError(message, 400));
      } else {
        next(error);
      }
    }
  };
}
