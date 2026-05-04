import { Router } from 'express';
import { requireAuth, requireSuperAdmin } from '../auth/auth.middleware.js';
import * as staffController from './staff.controller.js';

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.get('/', staffController.getStaffList);
router.post('/', staffController.addStaff);
router.get('/:id/referrals', staffController.getStaffReferrals);
router.patch('/:id/status', staffController.toggleStaffStatus);
router.delete('/:id', staffController.removeStaff);

export default router;
