import { Router } from 'express';
import * as categoryController from './category.controller.js';
import { requireAuth, requireStoreAdmin } from '../auth/auth.middleware.js';
import {
  validate,
  createCategorySchema,
  updateCategorySchema,
  categorySlugSchema,
  categoryIdSchema,
  toggleCategorySchema,
} from './category.validator.js';
import { upload } from '../../middleware/upload.js';

// ─── Public Routes (/api/categories) ─────────────────────────────────────

const publicRouter: Router = Router();

/** GET /api/categories — All active categories */
publicRouter.get('/', categoryController.getCategories);

/** GET /api/categories/:slug — Category with products */
publicRouter.get('/:slug', validate(categorySlugSchema), categoryController.getCategoryBySlug);

// ─── Admin Routes (/api/admin/categories) ────────────────────────────────

const adminRouter: Router = Router();

// All admin routes require auth + storeAdmin role
adminRouter.use(requireAuth, requireStoreAdmin);

/** GET /api/admin/categories — All categories (admin view) */
adminRouter.get('/', categoryController.getAdminCategories);

/** POST /api/admin/categories — Create category with optional image */
adminRouter.post(
  '/',
  upload.single('image'),
  validate(createCategorySchema),
  categoryController.createCategory,
);

/** PUT /api/admin/categories/:id — Update category */
adminRouter.put(
  '/:id',
  upload.single('image'),
  validate(updateCategorySchema),
  categoryController.updateCategory,
);

/** PATCH /api/admin/categories/:id/toggle-active — Toggle category active state */
adminRouter.patch(
  '/:id/toggle-active',
  validate(toggleCategorySchema),
  categoryController.toggleCategoryActive,
);

/** DELETE /api/admin/categories/:id — Soft delete */
adminRouter.delete(
  '/:id',
  validate(categoryIdSchema),
  categoryController.deleteCategory,
);

/** DELETE /api/admin/categories/:id/permanent — Hard delete */
adminRouter.delete(
  '/:id/permanent',
  validate(categoryIdSchema),
  categoryController.permanentlyDeleteCategory,
);

export { publicRouter as categoryPublicRoutes, adminRouter as categoryAdminRoutes };
