import { Router } from 'express';
import { requireAuth, requireStoreAdmin, requireSuperAdmin } from '../auth/auth.middleware.js';
import * as orderController from './order.controller.js';
import { validate, generateB2BInvoiceSchema } from './order.validator.js';

const router: Router = Router();

// ─── Super Admin Routes ──────────────────────────────────────────────────

/** POST /api/b2b-invoices/super-admin/create — Create and Persist B2B invoice */
router.post(
  '/super-admin/create',
  requireAuth,
  requireSuperAdmin,
  validate(generateB2BInvoiceSchema),
  orderController.createB2BInvoice
);

// ─── Admin Routes ────────────────────────────────────────────────────────

/** GET /api/b2b-invoices/admin/list — List B2B invoices for the logged-in store */
router.get(
  '/admin/list',
  requireAuth,
  requireStoreAdmin,
  orderController.getAdminB2BInvoices
);

/** GET /api/b2b-invoices/download/:id — Download a specific B2B invoice */
router.get(
  '/download/:id',
  requireAuth,
  requireStoreAdmin,
  orderController.downloadB2BInvoice
);

export default router;
