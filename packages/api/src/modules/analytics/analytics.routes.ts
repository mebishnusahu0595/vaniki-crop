import { Router } from 'express';
import * as analyticsController from './analytics.controller.js';
import { requireAuth, requireStoreAdmin, requireSuperAdmin } from '../auth/auth.middleware.js';
import { extractStoreId } from '../../middleware/store.middleware.js';

const router: Router = Router();

/** GET /api/analytics/superadmin — Global analytics dashboard */
router.get('/superadmin', requireAuth, requireSuperAdmin, analyticsController.getSuperAdminAnalytics);

/** GET /api/analytics/admin — Store-specific analytics dashboard */
router.get('/admin', requireAuth, requireStoreAdmin, extractStoreId, analyticsController.getStoreAdminAnalytics);

/** POST /api/analytics/pageview — Log page hit (Public) */
router.post('/pageview', analyticsController.recordPageView);

/** GET /api/analytics/website-reporting — Website traffic reports (SuperAdmin only) */
router.get('/website-reporting', requireAuth, requireSuperAdmin, analyticsController.getWebsiteReporting);

export default router;
