import { Router } from 'express';
import { upload } from '../../middleware/upload.js';
import { requireAuth, requireSuperAdmin } from '../auth/auth.middleware.js';
import * as superAdminController from './superadmin.controller.js';
import {
  analyticsQuerySchema,
  approveAdminSchema,
  createAdminSchema,
  createStoreSchema,
  createTestimonialSchema,
  customerQuerySchema,
  orderQuerySchema,
  orderStatusUpdateSchema,
  paymentQuerySchema,
  productRequestQuerySchema,
  reassignStoreAdminSchema,
  reorderTestimonialsSchema,
  toggleStoreSchema,
  toggleTestimonialSchema,
  updateAdminSchema,
  updateSiteSettingsSchema,
  updateStoreSchema,
  updateStoreSecretsSchema,
  updateProductRequestStatusSchema,
  updateTestimonialSchema,
  validate,
} from './superadmin.validator.js';

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get('/analytics', validate(analyticsQuerySchema), superAdminController.getAnalytics);

router.get('/stores', superAdminController.listStores);
router.post('/stores', validate(createStoreSchema), superAdminController.createStore);
router.put('/stores/:id', validate(updateStoreSchema), superAdminController.updateStore);
router.patch('/stores/:id/toggle-active', validate(toggleStoreSchema), superAdminController.toggleStoreActive);
router.patch('/stores/:id/reassign-admin', validate(reassignStoreAdminSchema), superAdminController.reassignStoreAdmin);
router.get('/stores/:id/secrets', superAdminController.getStoreSecrets);
router.patch('/stores/:id/secrets', validate(updateStoreSecretsSchema), superAdminController.updateStoreSecrets);

router.get('/admins', superAdminController.listAdmins);
router.post('/admins', upload.single('profileImage'), validate(createAdminSchema), superAdminController.createAdmin);
router.patch('/admins/:id', upload.single('profileImage'), validate(updateAdminSchema), superAdminController.updateAdmin);
router.patch('/admins/:id/deactivate', superAdminController.deactivateAdmin);
router.patch('/admins/:id/approval', validate(approveAdminSchema), superAdminController.approveAdmin);
router.delete('/admins/:id', superAdminController.deleteAdmin);

router.get('/customers', validate(customerQuerySchema), superAdminController.listCustomers);

router.get('/orders', validate(orderQuerySchema), superAdminController.listOrders);
router.get('/orders/:id', superAdminController.getOrderDetail);
router.patch('/orders/:id/status', validate(orderStatusUpdateSchema), superAdminController.updateOrderStatus);

router.get('/payments', validate(paymentQuerySchema), superAdminController.listPayments);
router.get('/product-requests', validate(productRequestQuerySchema), superAdminController.listProductRequests);
router.patch(
  '/product-requests/:id',
  validate(updateProductRequestStatusSchema),
  superAdminController.updateProductRequestStatus,
);

router.get('/testimonials', superAdminController.listTestimonials);
router.post(
  '/testimonials',
  upload.single('avatar'),
  validate(createTestimonialSchema),
  superAdminController.createTestimonial,
);
router.patch(
  '/testimonials/reorder',
  validate(reorderTestimonialsSchema),
  superAdminController.reorderTestimonials,
);
router.put(
  '/testimonials/:id',
  upload.single('avatar'),
  validate(updateTestimonialSchema),
  superAdminController.updateTestimonial,
);
router.patch(
  '/testimonials/:id/toggle',
  validate(toggleTestimonialSchema),
  superAdminController.toggleTestimonial,
);
router.delete('/testimonials/:id', superAdminController.deleteTestimonial);

router.get('/site-settings', superAdminController.getSiteSettings);
router.patch('/site-settings', validate(updateSiteSettingsSchema), superAdminController.updateSiteSettings);

export default router;
