import { Router } from 'express';
import * as whatsappController from './whatsapp.controller.js';
import { requireAuth, requireSuperAdmin } from '../auth/auth.middleware.js';

const router = Router();

// Webhook verification (GET) and incoming message handling (POST) from Meta
router.get('/webhook', whatsappController.verifyWebhook);
router.post('/webhook', whatsappController.handleWebhook);

// SuperAdmin: Broadcast marketing campaigns / notifications
router.post('/broadcast', requireAuth, requireSuperAdmin, whatsappController.sendBroadcast);

// SuperAdmin: Send single test message
router.post('/send-message', requireAuth, requireSuperAdmin, whatsappController.sendSingleMessage);

export default router;
