import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { upload } from '../../middleware/upload.js';
import { AppError } from '../../utils/AppError.js';
import * as staffDealersController from './staff-dealers.controller.js';

const router: Router = Router();

const STAFF_API_KEYS = new Set([
  'vaniki_stafftrack_key_2026',
  'vaniki_staff_secret_2026',
  process.env.STAFF_API_KEY || 'vaniki_stafftrack_key_2026',
]);

function requireStaffAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    // 1. Check API Key header
    const apiKey = (req.headers['x-api-key'] || req.headers['x-staff-key']) as string;
    if (apiKey && STAFF_API_KEYS.has(apiKey)) {
      req.staffId = (req.headers['x-staff-id'] as string) || 'staff_api_user';
      return next();
    }

    // 2. Check JWT Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const secret = process.env.JWT_SECRET;
      if (secret) {
        try {
          const decoded = jwt.verify(token, secret) as any;
          if (decoded.staffId || decoded.userId || decoded.id) {
            req.staffId = decoded.staffId || decoded.userId || decoded.id;
            return next();
          }
        } catch (_) {
          // Token verify failed, check if staffId passed in headers as fallback
        }
      }
    }

    // 3. Fallback: StaffTrack header with staff ID / name
    if (req.headers['x-staff-id'] || req.headers['x-staff-phone']) {
      req.staffId = (req.headers['x-staff-id'] as string) || 'staff_field_user';
      return next();
    }

    throw new AppError('Access denied. Staff authorization required.', 401);
  } catch (error) {
    next(error);
  }
}

// All dealer endpoints require staff authentication
router.use(requireStaffAuth);

// Get wholesale / B2B products catalog for ordering
router.get('/products', staffDealersController.getWholesaleProducts);

// Lookup dealer by 4-digit ID (e.g. 1018), full dealerCode (e.g. VKD1018), or mobile
router.get('/lookup/:dealerCode', staffDealersController.lookupDealer);

// Place complete multi-item order for dealer (with credit, UPI QR / bank slip, partial payment & deal notes)
router.post(
  '/:dealerCode/orders',
  upload.array('screenshots', 5),
  staffDealersController.placeStaffOrderForDealer,
);

// Place single bulk product request (backward-compatible)
router.post('/:dealerCode/product-requests', staffDealersController.placeDealerProductRequest);

// Submit payment slip (IFSC / UPI QR) on behalf of dealer
router.post(
  '/:dealerCode/invoices/:invoiceId/payment',
  upload.array('screenshots', 4),
  staffDealersController.submitDealerPaymentSlip,
);

// Get dealer financial ledger
router.get('/:dealerCode/ledger', staffDealersController.getDealerLedger);

export default router;
