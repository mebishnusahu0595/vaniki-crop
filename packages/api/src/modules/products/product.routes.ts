import { Router } from 'express';
import * as productController from './product.controller.js';
import { requireAuth, requireStoreAdmin } from '../auth/auth.middleware.js';
import {
  validate,
  createProductSchema,
  updateProductSchema,
  productSlugSchema,
  productIdSchema,
  productListQuerySchema,
  searchQuerySchema,
} from './product.validator.js';
import { upload } from '../../middleware/upload.js';

// ─── Public Routes (/api/products) ───────────────────────────────────────

const publicRouter: Router = Router();

/** GET /api/products — Paginated, filterable product list */
publicRouter.get('/', validate(productListQuerySchema), productController.getProducts);

/** GET /api/products/search?q=... — Full-text fuzzy search */
publicRouter.get('/search', validate(searchQuerySchema), productController.searchProducts);

/** GET /api/products/:slug — Full product detail with reviews */
publicRouter.get('/:slug', validate(productSlugSchema), productController.getProductBySlug);

// ─── Admin Routes (/api/admin/products) ──────────────────────────────────

const adminRouter: Router = Router();

// All admin routes require auth + storeAdmin role
adminRouter.use(requireAuth, requireStoreAdmin);

/** GET /api/admin/products — Admin product list (role-filtered) */
adminRouter.get('/', productController.getAdminProducts);

/** GET /api/admin/products/:id — Admin product detail */
adminRouter.get('/:id', validate(productIdSchema), productController.getAdminProductById);

/** POST /api/admin/products — Create product with images */
adminRouter.post(
  '/',
  upload.array('images', 5),
  validate(createProductSchema),
  productController.createProduct,
);

/** PUT /api/admin/products/:id — Update product */
adminRouter.put(
  '/:id',
  upload.array('images', 5),
  validate(updateProductSchema),
  productController.updateProduct,
);

/** PATCH /api/admin/products/:id/deactivate — Soft deactivate */
adminRouter.patch(
  '/:id/deactivate',
  validate(productIdSchema),
  productController.deactivateProduct,
);

/** DELETE /api/admin/products/:id — Permanent delete */
adminRouter.delete(
  '/:id',
  validate(productIdSchema),
  productController.deleteProduct,
);

export { publicRouter as productPublicRoutes, adminRouter as productAdminRoutes };
