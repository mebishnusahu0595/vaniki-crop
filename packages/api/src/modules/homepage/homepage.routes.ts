import { Router } from 'express';
import * as homepageController from './homepage.controller.js';
import { extractStoreId } from '../../middleware/store.middleware.js';

const router: Router = Router();

/** GET /api/homepage — Full storefront landing page data */
router.get('/', extractStoreId, homepageController.getHomepage);

export default router;
