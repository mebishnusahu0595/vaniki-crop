import { Router } from 'express';
import {
  getProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/** GET /api/products - List all active products (public) */
router.get('/', getProducts);

/** GET /api/products/:slug - Get a single product by slug (public) */
router.get('/:slug', getProductBySlug);

/** POST /api/products - Create a product (admin/super-admin only) */
router.post('/', authenticate, authorize('admin', 'super-admin'), createProduct);

/** PUT /api/products/:id - Update a product (admin/super-admin only) */
router.put('/:id', authenticate, authorize('admin', 'super-admin'), updateProduct);

/** DELETE /api/products/:id - Soft-delete a product (admin/super-admin only) */
router.delete('/:id', authenticate, authorize('admin', 'super-admin'), deleteProduct);

export default router;
