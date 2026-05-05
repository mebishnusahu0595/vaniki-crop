import type { Request, Response, NextFunction } from 'express';
import * as orderService from './order.service.js';
import { generateInvoicePdf, generateB2BInvoicePdf } from './invoice.service.js';
import { Order } from '../../models/Order.model.js';
import { Store } from '../../models/Store.model.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import { B2BInvoice } from '../../models/B2BInvoice.model.js';
import { AppError } from '../../utils/AppError.js';
import { createPaginationResponse, parsePagination } from '../../utils/pagination.js';

// ─── Customer Controllers ────────────────────────────────────────────────

/**
 * POST /api/orders/initiate
 */
export async function initiateOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = {
      ...req.body,
      storeId: req.body.storeId || req.storeId,
    };
    const result = await orderService.initiateOrder(req.userId!, payload);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/orders/place-cod
 */
export async function placeCodOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = {
      ...req.body,
      storeId: req.body.storeId || req.storeId,
    };
    const result = await orderService.placeCodOrder(req.userId!, payload);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/orders/confirm
 */
export async function confirmOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = {
      ...req.body,
      storeId: req.body.storeId || req.storeId,
    };
    const result = await orderService.confirmOrder(req.userId!, payload);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/orders/my
 */
export async function getMyOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await orderService.getMyOrders(req.userId!, req.query);
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
 * GET /api/orders/:id
 */
export async function getOrderDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await orderService.getOrderDetail((req.params as any).id, req.userId!);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/orders/:id/cancel
 */
export async function cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await orderService.cancelOrder((req.params as any).id, req.userId!);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/orders/:id/invoice
 */
export async function downloadInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderId = (req.params as any).id;
    const order = await Order.findById(orderId)
      .populate('userId', 'name mobile email savedAddress')
      .populate('storeId', 'name address phone email gstNumber sgstNumber cgst sgst igst panNumber')
      .populate('items.productId', 'name slug description shortDescription images');
    if (!order) throw new AppError('Order not found', 404);

    // Security: Check if user owns the order or is an admin
    const isAdmin = ['storeAdmin', 'superAdmin'].includes((req as any).userRole);
    const orderUserId = (order.userId as any)?._id?.toString() || order.userId.toString();
    if (!isAdmin && orderUserId !== req.userId) {
      throw new AppError('Unauthorized access to invoice', 403);
    }

    if (!order.userId || !order.storeId) throw new AppError('Incomplete order data', 400);

    const pdfBuffer = await generateInvoicePdf(order);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

// ─── Admin Controllers ───────────────────────────────────────────────────

/**
 * GET /api/admin/orders
 */
export async function getAdminOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Current setup ensures userStoreId is present for storeAdmin
    const result = await orderService.getAdminOrders(req.userStoreId!, req.query);
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
 * GET /api/orders/admin/:id
 */
export async function getAdminOrderDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await orderService.getAdminOrderDetail((req.params as any).id, req.userStoreId!);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/super-admin/orders
 */
export async function getSuperAdminOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await orderService.getSuperAdminOrders(req.query);
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
 * PATCH /api/admin/orders/:id/status
 */
export async function updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await orderService.updateOrderStatus((req.params as any).id, req.body, req.userId!);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/b2b-invoices/super-admin/create
 * Generates and persists a B2B invoice from platform to store.
 */
export async function createB2BInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { storeId, items, invoiceNumber, invoiceDate } = req.body;
    
    const store = await Store.findById(storeId);
    if (!store) throw new AppError('Store not found', 404);

    const siteSettings = await SiteSetting.findOne({ singletonKey: 'default' });
    if (!siteSettings) throw new AppError('Site settings not found', 404);

    // Calculate totals for persistence
    let subtotal = 0;
    let totalTaxAmount = 0;
    const processedItems = items.map((item: any) => {
      const taxAmount = (item.price * item.qty * item.taxRate) / 100;
      const total = (item.price * item.qty) + taxAmount;
      subtotal += item.price * item.qty;
      totalTaxAmount += taxAmount;
      return { ...item, taxAmount, total };
    });

    const finalInvoiceNumber = invoiceNumber || `B2B-${Date.now()}`;
    const finalInvoiceDate = invoiceDate ? new Date(invoiceDate) : new Date();

    const invoice = await B2BInvoice.create({
      storeId,
      invoiceNumber: finalInvoiceNumber,
      invoiceDate: finalInvoiceDate,
      items: processedItems,
      subtotal,
      totalTaxAmount,
      totalAmount: subtotal + totalTaxAmount,
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/b2b-invoices/admin/list
 */
export async function getAdminB2BInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const storeId = req.userStoreId;
    if (!storeId) throw new AppError('Store context not found', 400);

    const { page, limit, skip } = parsePagination(req.query);
    const filter = { storeId };

    const [invoices, total] = await Promise.all([
      B2BInvoice.find(filter).sort({ invoiceDate: -1 }).skip(skip).limit(limit),
      B2BInvoice.countDocuments(filter),
    ]);

    res.status(200).json(createPaginationResponse(invoices, total, page, limit));
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/b2b-invoices/download/:id
 */
export async function downloadB2BInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const invoice = await B2BInvoice.findById(id);
    if (!invoice) throw new AppError('Invoice not found', 404);

    // Check permissions
    if (req.userRole !== 'superAdmin' && invoice.storeId.toString() !== req.userStoreId) {
      throw new AppError('Unauthorized access to invoice', 403);
    }

    const store = await Store.findById(invoice.storeId);
    if (!store) throw new AppError('Store data missing', 404);

    const siteSettings = await SiteSetting.findOne({ singletonKey: 'default' });
    if (!siteSettings) throw new AppError('Site settings missing', 404);

    const pdfBuffer = await generateB2BInvoicePdf({
      invoice,
      siteSettings,
      store
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}
