import type { Request, Response, NextFunction } from 'express';
import * as contactService from './contact.service.js';

export async function submitContact(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await contactService.submitContact(req.body);
    res.status(200).json({
      success: true,
      message: "We'll get back to you within 24 hours",
    });
  } catch (error) {
    next(error);
  }
}
