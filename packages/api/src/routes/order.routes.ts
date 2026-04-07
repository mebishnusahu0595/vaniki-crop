import { Router } from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
} from '../controllers/order.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/** POST /api/orders - Create a new order (authenticated) */
router.post('/', authenticate, createOrder);

/** GET /api/orders/my - Get current user's orders */
router.get('/my', authenticate, getMyOrders);

/** GET /api/orders/:id - Get a specific order */
router.get('/:id', authenticate, getOrderById);

/** GET /api/orders - Get all orders (admin only) */
router.get('/', authenticate, authorize('admin', 'super-admin'), getAllOrders);

/** PATCH /api/orders/:id/status - Update order status (admin only) */
router.patch('/:id/status', authenticate, authorize('admin', 'super-admin'), updateOrderStatus);

export default router;
