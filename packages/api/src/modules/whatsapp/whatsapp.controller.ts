import type { Request, Response } from 'express';
import * as whatsappService from './whatsapp.service.js';

/**
 * Verifies the webhook with Meta
 */
export const verifyWebhook = (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'vanikicrop';
  if (mode === 'subscribe' && (token === expectedToken || token === 'vanikicrop' || token === 'anythingyouwant')) {
    console.log('[WhatsApp] Webhook verified successfully with token:', token);
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

/**
 * Handles incoming webhook events from Meta
 */aree
export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const { body } = req;

    // Check if it's a WhatsApp message event
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.value && change.value.messages) {
            for (const message of change.value.messages) {
              // Process message asynchronously
              whatsappService
                .processIncomingMessage(message, change.value.contacts?.[0] || {})
                .catch((err) => {
                  console.error('[WhatsApp] Error processing incoming message:', err);
                });
            }
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }

    return res.sendStatus(404);
  } catch (error) {
    console.error('[WhatsApp] Webhook error:', error);
    return res.sendStatus(500);
  }
};

/**
 * Admin: Send promotional broadcast campaign (with optional Image, Text, and Link)
 * POST /api/whatsapp/broadcast
 * Body: { title?: string, message: string, imageUrl?: string, link?: string, targetAudience?: 'all' | 'customers' | 'dealers' | 'custom', numbers?: string[], templateName?: string }
 */
export const sendBroadcast = async (req: Request, res: Response) => {
  try {
    const { title, message, imageUrl, link, targetAudience, numbers, templateName, languageCode, components } =
      req.body || {};

    if (!message && !templateName) {
      return res.status(400).json({ success: false, error: 'Provide either "message" or "templateName"' });
    }

    const result = await whatsappService.sendBroadcastCampaign({
      title,
      message,
      imageUrl,
      link,
      targetAudience,
      numbers,
      templateName,
      languageCode,
      components,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error('[WhatsApp Broadcast Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Admin: Send a single test message (with optional image and link)
 * POST /api/whatsapp/send-message
 * Body: { to: string, text: string, imageUrl?: string, link?: string }
 */
export const sendSingleMessage = async (req: Request, res: Response) => {
  try {
    const { to, text, imageUrl, link } = req.body || {};
    if (!to || (!text && !imageUrl)) {
      return res.status(400).json({ success: false, error: 'Missing "to" or "text"' });
    }

    const cleanNumber = String(to).replace(/\D/g, '');
    const recipient = cleanNumber.startsWith('91') ? cleanNumber : `91${cleanNumber}`;

    let fullText = text || '';
    if (link) {
      const fullLink = link.startsWith('http') ? link : `https://vanikicrop.com${link.startsWith('/') ? '' : '/'}${link}`;
      fullText += `\n\n🔗 *यहाँ क्लिक करें:*\n👉 ${fullLink}`;
    }

    let result;
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
      result = await whatsappService.sendImageMessage(recipient, imageUrl, fullText);
    } else {
      result = await whatsappService.sendTextMessage(recipient, fullText);
    }

    return res.status(200).json({ success: true, result });
  } catch (error: any) {
    console.error('[WhatsApp Send Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
