import { Router } from 'express';
import * as promotionsController from './promotions.controller.js';
import { requireAuth, requireStoreAdmin, requireSuperAdmin } from '../auth/auth.middleware.js';
import { upload } from '../../middleware/upload.js';

const router: Router = Router();

// ─── Dealer Routes ───────────────────────────────────────────────────────
router.get('/dealers', requireAuth, requireStoreAdmin, promotionsController.listDealersPromotions);

// ─── SuperAdmin Management Routes ────────────────────────────────────────
router.get('/admin', requireAuth, requireSuperAdmin, promotionsController.listAdminPromotions);
router.post('/admin', requireAuth, requireSuperAdmin, upload.single('image'), promotionsController.createPromotion);
router.put('/admin/:id', requireAuth, requireSuperAdmin, upload.single('image'), promotionsController.updatePromotion);
router.delete('/admin/:id', requireAuth, requireSuperAdmin, promotionsController.deletePromotion);

export default router;
