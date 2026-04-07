import { Router } from 'express';
import { getProfile, updateProfile, getAllUsers } from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/** GET /api/users/me - Get current user's profile */
router.get('/me', authenticate, getProfile);

/** PUT /api/users/me - Update current user's profile */
router.put('/me', authenticate, updateProfile);

/** GET /api/users - List all users (admin/super-admin only) */
router.get('/', authenticate, authorize('admin', 'super-admin'), getAllUsers);

export default router;
