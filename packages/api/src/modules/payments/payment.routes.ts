import { Router } from 'express';
import * as paymentController from './payment.controller.js';
import { requireAuth, requireStoreAdmin, requireSuperAdmin } from '../auth/auth.middleware.js';

const router: Router = Router();

/** POST /api/payments/webhook — Razorpay Webhook (Public, verified via signature) */
router.post('/webhook', paymentController.handleWebhook);

/** GET /api/admin/payments — Store-specific payments */
router.get('/admin/list', requireAuth, requireStoreAdmin, paymentController.getAdminPayments);

/** GET /api/super-admin/payments — Global payment list */
router.get('/super-admin/list', requireAuth, requireSuperAdmin, paymentController.getSuperAdminPayments);

export default router;
