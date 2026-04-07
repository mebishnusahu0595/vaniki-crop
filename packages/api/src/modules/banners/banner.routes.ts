import { Router } from 'express';
import * as bannerController from './banner.controller.js';
import { requireAuth, requireStoreAdmin, requireSuperAdmin } from '../auth/auth.middleware.js';
import { extractStoreId } from '../../middleware/store.middleware.js';
import { upload } from '../../middleware/upload.js';
import { 
  validate, 
  createBannerSchema, 
  updateBannerSchema, 
  reorderBannersSchema 
} from './banner.validator.js';

const router: Router = Router();

// ─── Public Routes ─────────────────────────────────────────────────────

/** GET /api/banners — List active banners */
router.get('/', extractStoreId, bannerController.listBanners);

// ─── Admin Routes ──────────────────────────────────────────────────

/** POST /api/admin/banners — Create banner with image */
router.get('/admin', requireAuth, requireStoreAdmin, bannerController.listAdminBanners);

/** POST /api/admin/banners — Create banner with image */
router.post(
  '/admin', 
  requireAuth, 
  requireStoreAdmin, 
  upload.single('image'), 
  validate(createBannerSchema), 
  bannerController.createBanner
);

/** PUT /api/admin/banners/:id — Update banner metadata/image */
router.put(
  '/admin/:id', 
  requireAuth, 
  requireStoreAdmin, 
  upload.single('image'), 
  validate(updateBannerSchema), 
  bannerController.updateBanner
);

/** DELETE /api/admin/banners/:id — Remove banner */
router.delete(
  '/admin/:id', 
  requireAuth, 
  requireStoreAdmin, 
  bannerController.deleteBanner
);

/** PATCH /api/admin/banners/reorder — Bulk update sort orders */
router.patch(
  '/admin/reorder', 
  requireAuth, 
  requireStoreAdmin, 
  validate(reorderBannersSchema), 
  bannerController.reorderBanners
);

export default router;
