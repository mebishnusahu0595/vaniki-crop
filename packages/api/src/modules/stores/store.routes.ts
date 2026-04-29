import { Router } from 'express';
import * as storeController from './store.controller.js';
import { requireAuth, requireStoreAdmin, requireSuperAdmin } from '../auth/auth.middleware.js';
import { validate, createStoreSchema, updateOwnStoreSchema, updateStoreSchema } from './store.validator.js';

const router: Router = Router();

// ─── Public Routes ─────────────────────────────────────────────────────

/** GET /api/stores — List all active stores */
router.get('/', storeController.listStores);

/** GET /api/stores/:id — Detailed store info */
router.get('/:id', storeController.getStoreDetail);

/** GET /api/stores/availability — Check product availability across stores */
router.get('/availability', storeController.getProductAvailability);

/** POST /api/stores/cart-availability — Check full cart availability across stores */
router.post('/cart-availability', storeController.getCartAvailability);

/** POST /api/stores/select — Save selection for authenticated user */
router.post('/select', requireAuth, storeController.selectStore);

/** GET /api/stores/admin/me — Store admin's own store settings */
router.get('/admin/me', requireAuth, requireStoreAdmin, storeController.getAdminOwnStore);

/** PATCH /api/stores/admin/me — Store admin updates own store settings */
router.patch('/admin/me', requireAuth, requireStoreAdmin, validate(updateOwnStoreSchema), storeController.updateAdminOwnStore);

/** GET /api/stores/admin/verify-gst/:gstin — Verify GSTIN */
router.get('/admin/verify-gst/:gstin', requireAuth, requireStoreAdmin, storeController.verifyGst);

// ─── Super Admin Routes ──────────────────────────────────────────────────

/** POST /api/superadmin/stores — Create new store */
router.post('/superadmin/create', requireAuth, requireSuperAdmin, validate(createStoreSchema), storeController.createStore);

/** PUT /api/superadmin/stores/:id — Update existing store */
router.put('/superadmin/:id', requireAuth, requireSuperAdmin, validate(updateStoreSchema), storeController.updateStore);

/** DELETE /api/superadmin/stores/:id — Soft deactivate store */
router.delete('/superadmin/:id', requireAuth, requireSuperAdmin, storeController.deleteStore);

export default router;
