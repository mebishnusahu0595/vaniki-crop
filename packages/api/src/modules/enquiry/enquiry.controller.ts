import type { Request, Response, NextFunction } from 'express';
import * as enquiryService from './enquiry.service.js';

export async function submitEnquiry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, mobile, category } = req.body;

    if (!name || !mobile || !category) {
      res.status(400).json({ success: false, error: 'Name, mobile, and category are required' });
      return;
    }

    // Resolve client IP safely
    let ipAddress = '';
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
      ipAddress = forwardedFor.split(',')[0].trim();
    } else if (Array.isArray(forwardedFor)) {
      ipAddress = forwardedFor[0].trim();
    } else {
      ipAddress = req.ip || req.socket.remoteAddress || '';
    }

    const data = await enquiryService.submitEnquiry({
      name,
      mobile,
      category,
      ipAddress,
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
