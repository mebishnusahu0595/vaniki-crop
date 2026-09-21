import { Router } from 'express';
import {
  syncCart,
  getMyCart,
  getAdminActiveCarts,
  deleteAdminCart,
} from './cart.controller.js';
import {
  requireAuth,
  requireSuperAdmin,
  optionalAuth,
} from '../auth/auth.middleware.js';

const router = Router();

/**
 * Public / User Routes
 */
router.post('/sync', optionalAuth, syncCart);
router.get('/my-cart', optionalAuth, getMyCart);

/**
 * SuperAdmin Routes
 */
router.get('/admin/active', requireAuth, requireSuperAdmin, getAdminActiveCarts);
router.delete('/admin/:id', requireAuth, requireSuperAdmin, deleteAdminCart);

export default router;
