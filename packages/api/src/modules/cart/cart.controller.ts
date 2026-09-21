import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Cart, type ICart, type CartSource, type CartUserType } from '../../models/Cart.model.js';
import { User } from '../../models/User.model.js';
import { Store } from '../../models/Store.model.js';
import { AppError } from '../../utils/AppError.js';

/**
 * POST /api/cart/sync
 * Syncs the current client-side cart (User App, Dealers Play App, User Web) to MongoDB.
 * Supports both authenticated users and anonymous guest sessions.
 */
export async function syncCart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      sessionId,
      items = [],
      couponCode = '',
      couponDiscount = 0,
      source = 'user_web',
      customerName: bodyName,
      customerPhone: bodyPhone,
    } = req.body;

    const userId = req.userId;
    let resolvedUserType: CartUserType = 'guest';
    let customerName = bodyName || '';
    let customerPhone = bodyPhone || '';
    let customerEmail = '';
    let storeId: mongoose.Types.ObjectId | undefined;
    let dealerBusinessName = '';

    if (userId) {
      const user = await User.findById(userId).lean();
      if (user) {
        customerName = user.name || customerName;
        customerPhone = user.mobile || customerPhone;
        customerEmail = user.email || customerEmail;

        const isDealer =
          user.role === 'storeAdmin' ||
          (user as any).role === 'dealer' ||
          Boolean((user as any).dealerCode);

        resolvedUserType = isDealer ? 'dealer' : 'user';

        if (isDealer) {
          const store = await Store.findOne({
            $or: [{ ownerId: user._id }, { _id: (user as any).storeId }],
          }).lean();
          if (store) {
            storeId = store._id as mongoose.Types.ObjectId;
            dealerBusinessName = store.name || '';
          }
        }
      }
    } else if (req.body.userType === 'dealer') {
      resolvedUserType = 'dealer';
    } else if (req.body.userType === 'user') {
      resolvedUserType = 'user';
    }

    const validSource: CartSource = ['user_app', 'dealer_app', 'user_web'].includes(source)
      ? source
      : 'user_web';

    // Format & validate items
    const formattedItems = (items || []).map((it: any) => ({
      productId: it.productId,
      variantId: String(it.variantId || 'default'),
      productSlug: it.productSlug || '',
      productName: it.productName || 'Unknown Product',
      variantLabel: it.variantLabel || '',
      price: Number(it.price || 0),
      mrp: Number(it.mrp || it.price || 0),
      qty: Math.max(1, Number(it.qty || 1)),
      image: it.image || '',
      stock: Number(it.stock || 0),
      hsnCode: it.hsnCode || '',
    }));

    const totalItems = formattedItems.reduce((sum: number, it: any) => sum + it.qty, 0);
    const subtotal = formattedItems.reduce((sum: number, it: any) => sum + it.price * it.qty, 0);

    const isCleared = formattedItems.length === 0;
    const status = isCleared ? 'cleared' : 'active';

    // Query filter for upserting
    let filter: any = null;
    if (userId) {
      filter = { userId };
    } else if (sessionId) {
      filter = { sessionId };
    }

    if (!filter) {
      res.status(200).json({ success: true, message: 'No userId or sessionId provided to persist cart.' });
      return;
    }

    const updateDoc: any = {
      $set: {
        userType: resolvedUserType,
        source: validSource,
        items: formattedItems,
        subtotal: Math.round(subtotal * 100) / 100,
        totalItems,
        couponCode,
        couponDiscount: Number(couponDiscount || 0),
        status,
        lastActiveAt: new Date(),
        ip: (req.headers['x-forwarded-for'] as string) || req.ip || '',
        userAgent: req.headers['user-agent'] || '',
      },
    };

    if (userId) updateDoc.$set.userId = userId;
    if (sessionId) updateDoc.$set.sessionId = sessionId;
    if (customerName) updateDoc.$set.customerName = customerName;
    if (customerPhone) updateDoc.$set.customerPhone = customerPhone;
    if (customerEmail) updateDoc.$set.customerEmail = customerEmail;
    if (storeId) updateDoc.$set.storeId = storeId;
    if (dealerBusinessName) updateDoc.$set.dealerBusinessName = dealerBusinessName;

    const cart = await Cart.findOneAndUpdate(filter, updateDoc, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    res.status(200).json({
      success: true,
      data: {
        cartId: cart._id,
        status: cart.status,
        totalItems: cart.totalItems,
        subtotal: cart.subtotal,
        lastActiveAt: cart.lastActiveAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/cart
 * Fetches the user's active cart
 */
export async function getMyCart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId;
    const sessionId = (req.query.sessionId as string) || '';

    let filter: any = null;
    if (userId) filter = { userId, status: 'active' };
    else if (sessionId) filter = { sessionId, status: 'active' };

    if (!filter) {
      res.status(200).json({ success: true, data: null });
      return;
    }

    const cart = await Cart.findOne(filter).lean();
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/cart/admin/active
 * Fetches paginated active and abandoned carts with real-time analytics for SuperAdmin
 */
export async function getAdminActiveCarts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const {
      userType,
      source,
      status = 'active',
      search,
      timeRange,
    } = req.query as Record<string, string | undefined>;

    const filter: any = {};

    // Status filter
    if (status && status !== 'all') {
      filter.status = status;
    } else {
      filter.status = 'active';
    }

    // Must have at least 1 item
    filter.totalItems = { $gt: 0 };

    // UserType filter
    if (userType && userType !== 'all') {
      filter.userType = userType;
    }

    // Source platform filter
    if (source && source !== 'all') {
      filter.source = source;
    }

    // Time filter
    if (timeRange) {
      const now = new Date();
      if (timeRange === '1h') {
        filter.lastActiveAt = { $gte: new Date(now.getTime() - 60 * 60 * 1000) };
      } else if (timeRange === '24h') {
        filter.lastActiveAt = { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
      } else if (timeRange === '7d') {
        filter.lastActiveAt = { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      } else if (timeRange === 'abandoned') {
        // Abandoned: inactive for > 1 hour
        filter.lastActiveAt = { $lt: new Date(now.getTime() - 60 * 60 * 1000) };
      }
    }

    // Search query
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { customerName: regex },
        { customerPhone: regex },
        { customerEmail: regex },
        { dealerBusinessName: regex },
        { 'items.productName': regex },
      ];
    }

    // Execute paginated search
    const [carts, total] = await Promise.all([
      Cart.find(filter)
        .populate('userId', 'name mobile email role profileImage savedAddress')
        .populate('storeId', 'name storeCode city state phone')
        .sort({ lastActiveAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Cart.countDocuments(filter),
    ]);

    // KPI Summary Aggregation across all active carts
    const statsAggregation = await Cart.aggregate([
      {
        $match: {
          status: 'active',
          totalItems: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$userType',
          count: { $sum: 1 },
          totalValue: { $sum: '$subtotal' },
          totalItems: { $sum: '$totalItems' },
        },
      },
    ]);

    let totalActiveCarts = 0;
    let totalPotentialRevenue = 0;
    let totalActiveItems = 0;
    let dealerCarts = 0;
    let dealerRevenue = 0;
    let userCarts = 0;
    let userRevenue = 0;
    let guestCarts = 0;
    let guestRevenue = 0;

    statsAggregation.forEach((stat) => {
      totalActiveCarts += stat.count;
      totalPotentialRevenue += stat.totalValue;
      totalActiveItems += stat.totalItems;

      if (stat._id === 'dealer') {
        dealerCarts = stat.count;
        dealerRevenue = stat.totalValue;
      } else if (stat._id === 'user') {
        userCarts = stat.count;
        userRevenue = stat.totalValue;
      } else if (stat._id === 'guest') {
        guestCarts = stat.count;
        guestRevenue = stat.totalValue;
      }
    });

    res.status(200).json({
      success: true,
      data: carts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalActiveCarts,
        totalPotentialRevenue: Math.round(totalPotentialRevenue * 100) / 100,
        totalActiveItems,
        dealerCarts,
        dealerRevenue: Math.round(dealerRevenue * 100) / 100,
        userCarts,
        userRevenue: Math.round(userRevenue * 100) / 100,
        guestCarts,
        guestRevenue: Math.round(guestRevenue * 100) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/cart/admin/:id
 * Removes or archives an abandoned cart
 */
export async function deleteAdminCart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid cart ID', 400);
    }

    await Cart.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Cart deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Helper to mark cart as converted when an order is created
 */
export async function markCartAsConverted(
  userId?: string | mongoose.Types.ObjectId,
  orderId?: string | mongoose.Types.ObjectId,
  sessionId?: string,
): Promise<void> {
  try {
    let filter: any = null;
    if (userId) filter = { userId, status: 'active' };
    else if (sessionId) filter = { sessionId, status: 'active' };

    if (!filter) return;

    await Cart.updateMany(filter, {
      $set: {
        status: 'converted',
        convertedOrderId: orderId,
        lastActiveAt: new Date(),
      },
    });
  } catch (err) {
    console.error('Error marking cart as converted:', err);
  }
}
