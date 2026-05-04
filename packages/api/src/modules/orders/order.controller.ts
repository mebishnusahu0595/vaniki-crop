import type { Request, Response, NextFunction } from 'express';
import * as orderService from './order.service.js';
import { generateOrderInvoice, generateB2BInvoice } from './invoice.service.js';
import { Order } from '../../models/Order.model.js';
import { User } from '../../models/User.model.js';
import { Store } from '../../models/Store.model.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import { AppError } from '../../utils/AppError.js';

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
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    // Security: Check if user owns the order or is an admin
    const isAdmin = ['admin', 'superadmin'].includes((req as any).userRole);
    if (!isAdmin && order.userId.toString() !== req.userId) {
      throw new AppError('Unauthorized access to invoice', 403);
    }

    const user = await User.findById(order.userId);
    const store = await Store.findById(order.storeId);
    if (!user || !store) throw new AppError('Incomplete order data', 400);

    const pdfBuffer = await generateOrderInvoice(order as any, user as any, store as any);

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
 * POST /api/super-admin/invoices/create
 * Generates a B2B invoice from platform to store.
 */
export async function createB2BInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { storeId, items, invoiceNumber, invoiceDate } = req.body;
    
    const store = await Store.findById(storeId);
    if (!store) throw new AppError('Store not found', 404);

    const siteSettings = await SiteSetting.findOne({ singletonKey: 'default' });
    if (!siteSettings) throw new AppError('Site settings not found', 404);

    const pdfBuffer = await generateB2BInvoice(
      { items, invoiceNumber, invoiceDate },
      siteSettings,
      store as any
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=b2b-invoice-${store.name.replace(/\s+/g, '-')}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}
