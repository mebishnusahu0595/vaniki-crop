import { Request, Response } from 'express';
import * as whatsappService from './whatsapp.service.js';

/**
 * Verifies the webhook with Meta
 */
export const verifyWebhook = (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

/**
 * Handles incoming webhook events from Meta
 */
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
              whatsappService.processIncomingMessage(message, change.value.contacts?.[0] || {}).catch(err => {
                console.error('Error processing WhatsApp message:', err);
              });
            }
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }

    return res.sendStatus(404);
  } catch (error) {
    console.error('Webhook error:', error);
    return res.sendStatus(500);
  }
};
