import { Router } from 'express';
import * as whatsappController from './whatsapp.controller.js';

const router = Router();

// Webhook verification (GET) and message handling (POST)
router.get('/webhook', whatsappController.verifyWebhook);
router.post('/webhook', whatsappController.handleWebhook);

export default router;
