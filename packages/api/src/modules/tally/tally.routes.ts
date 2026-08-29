import { Router } from 'express';
import * as tallyController from './tally.controller.js';
import { requireAuth, requireSuperAdmin } from '../auth/auth.middleware.js';

const router: Router = Router();

/** GET /api/tally/pending-sync — Fetch pending invoices for Windows Agent */
router.get('/pending-sync', tallyController.getPendingQueue);

/** POST /api/tally/sync-result — Record Tally sync result from Windows Agent */
router.post('/sync-result', tallyController.postSyncResult);

/** GET /api/tally/download-xml/:id — Download Tally XML file for invoice */
router.get('/download-xml/:id', requireAuth, requireSuperAdmin, tallyController.downloadXml);

/** GET /api/tally/settings — Get Tally Configuration */
router.get('/settings', requireAuth, requireSuperAdmin, tallyController.getSettings);

export default router;
