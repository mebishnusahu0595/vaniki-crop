import { Router } from 'express';
import { requireAuth, requireStoreAdmin } from '../auth/auth.middleware.js';
import * as adminController from './admin.controller.js';

const router: Router = Router();

router.use(requireAuth, requireStoreAdmin);

router.get('/search', adminController.searchAdmin);
router.get('/customers', adminController.listCustomers);

export default router;
