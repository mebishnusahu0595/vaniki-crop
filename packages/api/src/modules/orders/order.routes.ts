import { Router } from 'express';
import * as orderController from './order.controller.js';
import { requireAuth, requireStoreAdmin, requireSuperAdmin } from '../auth/auth.middleware.js';
import {
  validate,
  initiateOrderSchema,
  placeCodOrderSchema,
  confirmOrderSchema,
  updateOrderStatusSchema,
  generateB2BInvoiceSchema,
} from './order.validator.js';

const router: Router = Router();

// ─── Customer Routes ─────────────────────────────────────────────────────

/** POST /api/orders/initiate — Start order creation */
router.post('/initiate', requireAuth, validate(initiateOrderSchema), orderController.initiateOrder);

/** POST /api/orders/place-cod — Place a cash-on-delivery order */
router.post('/place-cod', requireAuth, validate(placeCodOrderSchema), orderController.placeCodOrder);

/** POST /api/orders/confirm — Verify payment and save order */
router.post('/confirm', requireAuth, validate(confirmOrderSchema), orderController.confirmOrder);

/** GET /api/orders/my — Customer's own order history */
router.get('/my', requireAuth, orderController.getMyOrders);

/** GET /api/orders/:id — Specific order details */
router.get('/:id', requireAuth, orderController.getOrderDetail);

/** PATCH /api/orders/:id/cancel — Customer cancellation */
router.patch('/:id/cancel', requireAuth, orderController.cancelOrder);

/** GET /api/orders/:id/invoice — Download invoice PDF */
router.get('/:id/invoice', requireAuth, orderController.downloadInvoice);

// ─── Store Admin Routes ──────────────────────────────────────────────────

/** GET /api/admin/orders — Store-specific orders */
router.get('/admin/list', requireAuth, requireStoreAdmin, orderController.getAdminOrders);

/** GET /api/admin/orders/:id — Store-specific order detail */
router.get('/admin/:id', requireAuth, requireStoreAdmin, orderController.getAdminOrderDetail);

/** PATCH /api/admin/orders/:id/status — Update order and notify customer */
router.patch('/admin/:id/status', requireAuth, requireStoreAdmin, validate(updateOrderStatusSchema), orderController.updateOrderStatus);

// ─── Super Admin Routes ──────────────────────────────────────────────────

/** GET /api/super-admin/orders — Global order list */
router.get('/super-admin/list', requireAuth, requireSuperAdmin, orderController.getSuperAdminOrders);

/** POST /api/super-admin/invoices/create — Create B2B invoice */
router.post('/super-admin/invoices/create', requireAuth, requireSuperAdmin, validate(generateB2BInvoiceSchema), orderController.createB2BInvoice);

export default router;
