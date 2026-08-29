import type { Request, Response, NextFunction } from 'express';
import * as tallyService from './tally.service.js';
import { B2BInvoice } from '../../models/B2BInvoice.model.js';
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

    const limit = Number(req.query.limit) || 20;
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

    const { invoiceId, status, tallyVoucherNumber, tallyVoucherGuid, error } = req.body;
    if (!invoiceId || !status) {
      throw new AppError('invoiceId and status are required', 400);
    }

    const invoice = await tallyService.recordTallySyncResult(invoiceId, {
      status,
      tallyVoucherNumber,
      tallyVoucherGuid,
      error,
    });

    res.status(200).json({
      success: true,
      message: 'Tally sync status updated',
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tally/download-xml/:id
 * Direct download of Tally-compliant XML voucher
 */
export async function downloadXml(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const invoice = await B2BInvoice.findById(req.params.id).populate('storeId', 'name address gstin phone');
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    const config = await tallyService.getTallyConfig();
    const store = (invoice.storeId as any) || {};
    const xml = tallyService.buildTallySalesVoucherXml(invoice, store, config);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="Tally_Invoice_${invoice.invoiceNumber}.xml"`);
    res.status(200).send(xml);
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
