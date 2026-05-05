import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { upload } from '../../middleware/upload.js';
import { AppError } from '../../utils/AppError.js';
import { requireAuth, requireSuperAdmin } from '../auth/auth.middleware.js';
import * as staffController from './staff.controller.js';

const router = Router();

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

router.post('/login', staffController.loginStaff);
router.get('/me', requireStaffAuth, staffController.getStaffMe);
router.get('/tasks', requireStaffAuth, staffController.getStaffTasks);
router.get('/tasks/:id', requireStaffAuth, staffController.getStaffTask);
router.patch('/tasks/:id/complete', requireStaffAuth, staffController.markTaskCompleted);
router.post('/tasks/:id/deliver', requireStaffAuth, upload.single('proofImage'), staffController.deliverTask);
router.post('/tasks/:id/cancel', requireStaffAuth, staffController.cancelTask);

router.use(requireAuth, requireSuperAdmin);

router.get('/orders/available', staffController.getAvailableDeliveryOrders);
router.get('/', staffController.getStaffList);
router.post('/', staffController.addStaff);
router.get('/:id', staffController.getStaffDetail);
router.post('/:id/assign-order', staffController.assignDelivery);
router.get('/:id/referrals', staffController.getStaffReferrals);
router.patch('/:id/status', staffController.toggleStaffStatus);
router.delete('/:id', staffController.removeStaff);

export default router;
