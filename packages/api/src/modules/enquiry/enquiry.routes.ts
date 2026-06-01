import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as enquiryController from './enquiry.controller.js';

const router: Router = Router();

const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 submissions per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many enquiry form submissions from this IP. Please try again later.',
  },
});

router.post('/', enquiryLimiter, enquiryController.submitEnquiry);

export default router;
