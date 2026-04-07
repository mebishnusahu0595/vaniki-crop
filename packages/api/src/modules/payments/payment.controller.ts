import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import * as paymentService from './payment.service.js';

/**
 * POST /api/payments/webhook
 * Handles incoming Razorpay webhooks with signature verification.
 */
export async function handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('[WEBHOOK] Invalid signature received');
      res.status(400).json({ success: false, message: 'Invalid signature' });
      return;
    }

    const { event, payload } = req.body;
    console.log(`[WEBHOOK] Received event: ${event}`);

    await paymentService.handleWebhookEvent(event, payload);

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/payments
 */
export async function getAdminPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await paymentService.getAdminPayments(req.userStoreId!, req.query);
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/super-admin/payments
 */
export async function getSuperAdminPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await paymentService.getSuperAdminPayments(req.query);
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}
