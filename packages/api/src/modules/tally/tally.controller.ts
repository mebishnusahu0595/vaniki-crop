import type { Request, Response, NextFunction } from 'express';
import * as tallyService from './tally.service.js';
import { B2BInvoice } from '../../models/B2BInvoice.model.js';
import { Order } from '../../models/Order.model.js';
import { AppError } from '../../utils/AppError.js';

/**
 * GET /api/tally/pending-sync
 * Polled by Windows Tally Agent
 */
export async function getPendingQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const secret = req.headers['x-tally-secret'] || req.query.secret;
    const config = await tallyService.getTallyConfig();

    if (secret !== config.agentSecretKey && (req as any).userRole !== 'superAdmin') {
      throw new AppError('Invalid Tally Agent secret key', 401);
    }

    const limit = Number(req.query.limit) || 30;
    const queue = await tallyService.getPendingTallySyncInvoices(limit);

    res.status(200).json({
      success: true,
      count: queue.length,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tally/sync-result
 * Sent by Windows Tally Agent after posting to Port 9000
 */
export async function postSyncResult(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const secret = req.headers['x-tally-secret'] || req.body.secret;
    const config = await tallyService.getTallyConfig();

    if (secret !== config.agentSecretKey && (req as any).userRole !== 'superAdmin') {
      throw new AppError('Invalid Tally Agent secret key', 401);
    }

    const entityId = req.body.entityId || req.body.invoiceId || req.body.orderId;
    const { status, tallyVoucherNumber, tallyVoucherGuid, error, type } = req.body;

    if (!entityId || !status) {
      throw new AppError('entityId and status are required', 400);
    }

    const result = await tallyService.recordTallySyncResult(entityId, {
      status,
      type,
      tallyVoucherNumber,
      tallyVoucherGuid,
      error,
    });

    res.status(200).json({
      success: true,
      message: 'Tally sync status updated',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tally/download-xml/:id
 * Direct download of Tally-compliant XML voucher for Order or B2B Invoice
 */
export async function downloadXml(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id as string;
    const config = await tallyService.getTallyConfig();

    // 1. Try finding B2B Invoice
    const invoice = await B2BInvoice.findById(id).populate('storeId', 'name address gstin phone');
    if (invoice) {
      const store = (invoice.storeId as any) || {};
      const xml = tallyService.buildTallySalesVoucherXml(invoice, store, config);
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="Tally_B2B_${invoice.invoiceNumber}.xml"`);
      res.status(200).send(xml);
      return;
    }

    // 2. Try finding Retail Order
    const order = await Order.findById(id)
      .populate('userId', 'name mobile email savedAddress gstNumber')
      .populate('storeId', 'name address phone gstNumber sgstNumber cgst sgst igst panNumber');

    if (order) {
      const user = (order.userId as any) || {};
      const store = (order.storeId as any) || {};
      const xml = tallyService.buildTallyRetailOrderVoucherXml(order, user, store, config);
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="Tally_Order_${order.orderNumber}.xml"`);
      res.status(200).send(xml);
      return;
    }

    throw new AppError('Document not found for XML generation', 404);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tally/settings
 */
export async function getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = await tallyService.getTallyConfig();
    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/tally/settings
 */
export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const updated = await tallyService.updateTallyConfig(req.body);
    res.status(200).json({
      success: true,
      message: 'Tally configuration updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tally/sync-now
 * Trigger immediate direct push of all pending invoices and orders to Tally Server
 */
export async function syncNow(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const summary = await tallyService.syncAllPendingToTally();
    res.status(200).json({
      success: true,
      message: `Tally sync completed. Processed: ${summary.totalProcessed}, Success: ${summary.successCount}, Failed: ${summary.failedCount}`,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tally/sync-order/:id
 */
export async function syncOrderNow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderId = req.params.id as string;
    const order = await Order.findById(orderId)
      .populate('userId', 'name mobile email savedAddress gstNumber')
      .populate('storeId', 'name address phone gstNumber sgstNumber cgst sgst igst panNumber');

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const config = await tallyService.getTallyConfig();
    const user = (order.userId as any) || {};
    const store = (order.storeId as any) || {};
    const xml = tallyService.buildTallyRetailOrderVoucherXml(order, user, store, config);

    const syncRes = await tallyService.pushXmlToTallyServer(xml, config);

    if (syncRes.success) {
      await tallyService.recordTallySyncResult(orderId, {
        status: 'synced',
        type: 'retail_order',
        tallyVoucherNumber: syncRes.voucherNumber || order.orderNumber,
        tallyVoucherGuid: syncRes.voucherGuid,
      });
      res.status(200).json({
        success: true,
        message: 'Order synced to Tally successfully',
        voucherNumber: syncRes.voucherNumber || order.orderNumber,
      });
    } else {
      await tallyService.recordTallySyncResult(orderId, {
        status: 'failed',
        type: 'retail_order',
        error: syncRes.error,
      });
      res.status(400).json({
        success: false,
        message: syncRes.error || 'Tally push failed',
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/tally/sync-invoice/:id
 */
export async function syncInvoiceNow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const invoiceId = req.params.id as string;
    const invoice = await B2BInvoice.findById(invoiceId).populate('storeId', 'name address gstin phone');

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    const config = await tallyService.getTallyConfig();
    const store = (invoice.storeId as any) || {};
    const xml = tallyService.buildTallySalesVoucherXml(invoice, store, config);

    const syncRes = await tallyService.pushXmlToTallyServer(xml, config);

    if (syncRes.success) {
      await tallyService.recordTallySyncResult(invoiceId, {
        status: 'synced',
        type: 'b2b',
        tallyVoucherNumber: syncRes.voucherNumber || invoice.invoiceNumber,
        tallyVoucherGuid: syncRes.voucherGuid,
      });
      res.status(200).json({
        success: true,
        message: 'Invoice synced to Tally successfully',
        voucherNumber: syncRes.voucherNumber || invoice.invoiceNumber,
      });
    } else {
      await tallyService.recordTallySyncResult(invoiceId, {
        status: 'failed',
        type: 'b2b',
        error: syncRes.error,
      });
      res.status(400).json({
        success: false,
        message: syncRes.error || 'Tally push failed',
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tally/status
 * Ping Tally HTTP server
 */
export async function getTallyServerStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const host = req.query.host ? String(req.query.host) : undefined;
    const port = req.query.port ? Number(req.query.port) : undefined;
    const result = await tallyService.testTallyConnection(host, port);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
