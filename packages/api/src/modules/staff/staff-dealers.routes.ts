import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { upload } from '../../middleware/upload.js';
import { AppError } from '../../utils/AppError.js';
import * as staffDealersController from './staff-dealers.controller.js';

const router: Router = Router();

function requireStaffAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Access denied. Staff token required.', 401);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError('JWT_SECRET is not configured', 500);
    }

    const decoded = jwt.verify(authHeader.split(' ')[1], secret) as { staffId?: string; role?: string };
    if (decoded.role !== 'staff' || !decoded.staffId) {
      throw new AppError('Invalid staff token.', 401);
    }

    req.staffId = decoded.staffId;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Staff session expired. Please login again.', 401));
    } else {
      next(new AppError('Invalid staff token.', 401));
    }
  }
}

// All dealer endpoints require staff authentication
router.use(requireStaffAuth);

// Lookup dealer by code (e.g. VKD1001) or mobile
router.get('/lookup/:dealerCode', staffDealersController.lookupDealer);

// Place a bulk product request on behalf of the dealer
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
