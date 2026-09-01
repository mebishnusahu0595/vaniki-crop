import { Router } from 'express';
import * as tallyController from './tally.controller.js';
import { requireAuth, requireSuperAdmin } from '../auth/auth.middleware.js';

const router: Router = Router();

/** GET /api/tally/pending-sync — Fetch pending invoices & orders for Windows Agent or Server Sync */
router.get('/pending-sync', tallyController.getPendingQueue);

/** POST /api/tally/sync-result — Record Tally sync result */
router.post('/sync-result', tallyController.postSyncResult);

/** GET /api/tally/download-xml/:id — Download Tally XML file for invoice or order */
router.get('/download-xml/:id', requireAuth, requireSuperAdmin, tallyController.downloadXml);

/** GET /api/tally/settings — Get Tally Configuration */
router.get('/settings', requireAuth, requireSuperAdmin, tallyController.getSettings);

/** PUT /api/tally/settings — Update Tally Configuration */
router.put('/settings', requireAuth, requireSuperAdmin, tallyController.updateSettings);

/** POST /api/tally/sync-now — Trigger immediate direct push to Tally Server */
router.post('/sync-now', requireAuth, requireSuperAdmin, tallyController.syncNow);

/** POST /api/tally/sync-order/:id — Direct push single order to Tally */
router.post('/sync-order/:id', requireAuth, requireSuperAdmin, tallyController.syncOrderNow);

/** POST /api/tally/sync-invoice/:id — Direct push single invoice to Tally */
router.post('/sync-invoice/:id', requireAuth, requireSuperAdmin, tallyController.syncInvoiceNow);

/** GET /api/tally/status — Check live connection status to Tally Server */
router.get('/status', requireAuth, requireSuperAdmin, tallyController.getTallyServerStatus);

export default router;
