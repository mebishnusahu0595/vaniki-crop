import type { Response, NextFunction } from 'express';
import { Order } from '../models/Order.model.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../middleware/auth.js';

/**
 * Creates a new order for the authenticated user.
 * POST /api/orders
 * @param req - Authenticated request with order data in body
 * @param res - Express response
 * @param next - Express next function
 */
export async function createOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderNumber = await Order.generateOrderNumber();

    const order = await Order.create({
      ...req.body,
      orderNumber,
      userId: req.userId,
    });
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetches all orders for the authenticated user.
 * GET /api/orders/my
 * @param req - Authenticated request
 * @param res - Express response
 * @param next - Express next function
 */
export async function getMyOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetches a single order by ID (owner or admin).
 * GET /api/orders/:id
 * @param req - Authenticated request with order ID param
 * @param res - Express response
 * @param next - Express next function
 */
export async function getOrderById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await Order.findById(req.params.id).populate('items.productId');
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    // Only owner or admin can view
    if (order.userId.toString() !== req.userId && req.userRole === 'customer') {
      throw new ApiError(403, 'Not authorized to view this order');
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetches all orders (admin only) with pagination.
 * GET /api/orders
 * @param req - Authenticated admin request with optional query params
 * @param res - Express response
 * @param next - Express next function
 */
export async function getAllOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find().populate('userId', 'name email mobile').skip(skip).limit(limit).sort({ createdAt: -1 }),
      Order.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates order status (admin only).
 * PATCH /api/orders/:id/status
 * @param req - Authenticated admin request with { status, note } in body
 * @param res - Express response
 * @param next - Express next function
 */
export async function updateOrderStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }

    order.status = status;
    order.statusHistory.push({
      status,
      note,
      updatedBy: req.userId as any,
      timestamp: new Date(),
    });
    await order.save();

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
}
