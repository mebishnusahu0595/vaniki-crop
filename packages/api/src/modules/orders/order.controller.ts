import type { Request, Response, NextFunction } from 'express';
import * as orderService from './order.service.js';

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
