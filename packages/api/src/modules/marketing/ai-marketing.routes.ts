import { Router } from 'express';
import * as aiMarketingController from './ai-marketing.controller.js';
import { requireAuth, requireSuperAdmin } from '../auth/auth.middleware.js';

const router = Router();

// SuperAdmin: Get and update auto-pilot settings
router.get('/settings', requireAuth, requireSuperAdmin, aiMarketingController.getSettings);
router.put('/settings', requireAuth, requireSuperAdmin, aiMarketingController.updateSettings);

// SuperAdmin: Preview AI generated advisory without sending
router.post('/preview', requireAuth, requireSuperAdmin, aiMarketingController.previewAdvisory);

// SuperAdmin: Trigger broadcast campaign (manual on-demand or with edited advisory)
router.post('/broadcast', requireAuth, requireSuperAdmin, aiMarketingController.triggerCampaign);

// SuperAdmin: View campaign history
router.get('/history', requireAuth, requireSuperAdmin, aiMarketingController.getHistory);

export default router;
