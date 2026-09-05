import { Router } from 'express';
import { requireAuth, requireStoreAdmin, requireSuperAdmin } from '../auth/auth.middleware.js';
import { upload } from '../../middleware/upload.js';
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

/** GET /api/b2b-invoices/super-admin/list — List all B2B invoices */
router.get(
  '/super-admin/list',
  requireAuth,
  requireSuperAdmin,
  orderController.getSuperAdminB2BInvoices
);

/** PATCH /api/b2b-invoices/super-admin/:id/verify-payment — Superadmin marks invoice paid/unpaid */
router.patch(
  '/super-admin/:id/verify-payment',
  requireAuth,
  requireSuperAdmin,
  orderController.verifyB2BInvoicePayment
);

// ─── Shared & Admin Routes ────────────────────────────────────────────────

/** GET /api/b2b-invoices/payment-details — Get platform Bank Details & QR code */
router.get(
  '/payment-details',
  requireAuth,
  orderController.getB2BPaymentDetails
);

/** GET /api/b2b-invoices/admin/list — List B2B invoices for the logged-in store */
router.get(
  '/admin/list',
  requireAuth,
  requireStoreAdmin,
  orderController.getAdminB2BInvoices
);

/** POST /api/b2b-invoices/:id/submit-payment — Dealer submits UTR & 1-4 screenshot payment proofs */
router.post(
  '/:id/submit-payment',
  requireAuth,
  requireStoreAdmin,
  upload.array('screenshots', 4),
  orderController.submitB2BInvoicePayment
);

/** GET /api/b2b-invoices/download/:id — Download a specific B2B invoice */
router.get(
  '/download/:id',
  requireAuth,
  orderController.downloadB2BInvoice
);

export default router;
