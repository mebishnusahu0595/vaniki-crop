import { Router } from 'express';
import { requireAuth, requireStoreAdmin } from '../auth/auth.middleware.js';
import * as adminController from './admin.controller.js';

const router: Router = Router();

router.use(requireAuth, requireStoreAdmin);

router.get('/search', adminController.searchAdmin);
router.get('/customers', adminController.listCustomers);
router.get('/inventory', adminController.listInventory);
router.patch('/inventory', adminController.updateInventory);
router.get('/garages', adminController.getGarages);
router.get('/product-requests', adminController.listProductRequests);
router.post('/product-requests', adminController.createProductRequest);

export default router;
