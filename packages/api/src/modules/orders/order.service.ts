import crypto from 'crypto';
import mongoose from 'mongoose';
import { DealerInventory } from '../../models/DealerInventory.model.js';
import { Order, type IOrder } from '../../models/Order.model.js';
import { Product } from '../../models/Product.model.js';
import { Store } from '../../models/Store.model.js';
import { User } from '../../models/User.model.js';
import { validateCoupon } from '../coupons/coupon.service.js';
import { razorpay } from '../../config/razorpay.js';
import { AppError } from '../../utils/AppError.js';
import { addEmailToQueue } from '../../queues/email.queue.js';
import { orderPlacedTemplate, orderStatusUpdateTemplate } from '../../utils/emailTemplates.js';
import { sendExpoPushNotification } from '../../utils/expoPush.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import { createPaginationResponse, parsePagination } from '../../utils/pagination.js';

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Calculates cart totals and validates item availability.
 */
async function calculateCart(items: any[], storeId: string) {
  let subtotal = 0;
  const validatedItems = [];

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product || !product.isActive) {
      throw new AppError(`Product "${item.productName || item.productId}" not found or inactive`, 400);
    }

    // Products without store assignment are treated as globally available.
    const assignedStoreIds = (product.storeId || []).map((id: any) => id.toString());
    const isAvailableAtStore = assignedStoreIds.length === 0 || assignedStoreIds.includes(storeId);
    if (!isAvailableAtStore) {
      throw new AppError(`Product "${product.name}" is not available at the selected store`, 400);
    }

    const variant = (product.variants as any).id(item.variantId);
    if (!variant) {
      throw new AppError(`Variant not found for product "${product.name}"`, 400);
    }

    const inventoryRow = await DealerInventory.findOne({
      storeId,
      productId: product._id,
      variantId: item.variantId,
    }).select('quantity');

    const availableStock = inventoryRow ? inventoryRow.quantity : variant.stock;

    if (availableStock < item.qty) {
      throw new AppError(`Not enough stock for "${product.name} - ${variant.label}"`, 400);
    }

    subtotal += variant.price * item.qty;
    validatedItems.push({
      productId: product._id,
      variantId: item.variantId,
      productName: product.name,
      variantLabel: variant.label,
      price: variant.price,
      mrp: variant.mrp,
      qty: item.qty,
      image: product.images.length > 0 ? product.images[0].url : undefined,
      loyaltyPointEligible: product.loyaltyPointEligible,
      maxLoyaltyPoints: product.maxLoyaltyPoints,
    });
  }

  return { subtotal, validatedItems };
}

async function resolveStoreIdForOrder(items: any[], serviceMode: 'delivery' | 'pickup', requestedStoreId?: string): Promise<string> {
  if (requestedStoreId) {
    return requestedStoreId;
  }

  if (serviceMode === 'pickup') {
    throw new AppError('Please choose a pickup store to place this order', 400);
  }

  const activeStores = await Store.find({ isActive: true }).select('_id').lean();
  const activeStoreIds = activeStores.map((store) => store._id.toString());

  if (!activeStoreIds.length) {
    throw new AppError('No active stores are available to fulfil this order right now', 400);
  }

  let candidateStoreIds: Set<string> | null = null;

  for (const item of items) {
    const product = await Product.findById(item.productId).select('isActive storeId name');
    if (!product || !product.isActive) {
      throw new AppError(`Product "${item.productName || item.productId}" not found or inactive`, 400);
    }

    const assignedStoreIds = (product.storeId || []).map((id: any) => id.toString());
    const productStoreIds = assignedStoreIds.length ? assignedStoreIds : activeStoreIds;

    if (candidateStoreIds === null) {
      candidateStoreIds = new Set(productStoreIds);
      continue;
    }

    const intersection = productStoreIds.filter((id) => candidateStoreIds!.has(id));
    candidateStoreIds = new Set(intersection);

    if (!candidateStoreIds.size) {
      break;
    }
  }

  if (!candidateStoreIds || !candidateStoreIds.size) {
    throw new AppError('No single store can fulfil all cart items. Please choose pickup store or update cart.', 400);
  }

  for (const candidateStoreId of candidateStoreIds) {
    try {
      await calculateCart(items, candidateStoreId);
      return candidateStoreId;
    } catch {
      // Try next candidate; final error is thrown below if no candidate works.
    }
  }

  throw new AppError('Items are currently unavailable in stock for delivery. Please choose another store or update cart.', 400);
}

export function applyVisibleOrderFilter(filter: Record<string, any>) {
  const visibilityFilter = {
    $or: [
      { paymentMethod: 'cod' },
      { paymentStatus: 'paid' },
    ],
  };

  filter.$and = Array.isArray(filter.$and)
    ? [...filter.$and, visibilityFilter]
    : [visibilityFilter];

  return filter;
}

// ─── Customer Services ───────────────────────────────────────────────────

/**
 * Initiates an order by calculating totals and creating a Razorpay order.
 * 
 * @param userId - ID of the authenticated user
 * @param input - Order data from frontend
 */
export async function initiateOrder(userId: string, input: any) {
  const { storeId, items, serviceMode, couponCode, shippingAddress, loyaltyPoints } = input;

  // 1. Basic validation
  if (serviceMode === 'delivery' && !shippingAddress) {
    throw new AppError('Shipping address is required for delivery orders', 400);
  }

  const resolvedStoreId = await resolveStoreIdForOrder(items, serviceMode, storeId);

  const store = await Store.findById(resolvedStoreId);
  if (!store || !store.isActive) {
    throw new AppError('Store not found or inactive', 400);
  }

  // 2. Calculate Subtotal & Validate Stock
  const { subtotal, validatedItems } = await calculateCart(items, resolvedStoreId);

  // 3. Handle Coupon
  let couponDiscount = 0;
  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, resolvedStoreId, subtotal, userId);
    if (!couponResult.valid) {
      throw new AppError(couponResult.message, 400);
    }
    couponDiscount = couponResult.discount!;
  }

  // 4. Delivery Charge
  const siteSettings = await SiteSetting.findOne({ singletonKey: 'default' });
  const threshold = siteSettings?.freeDeliveryThreshold ?? 1000;
  const charge = siteSettings?.standardDeliveryCharge ?? 50;

  const deliveryCharge = serviceMode === 'delivery' ? (subtotal >= threshold ? 0 : charge) : 0;

  // 4.5 Loyalty Points
  let loyaltyDiscount = 0;
  let loyaltyPointsApplied = 0;
  if (loyaltyPoints > 0) {
    const user = await User.findById(userId);
    if (!user || user.loyaltyPoints < loyaltyPoints) {
      throw new AppError('Insufficient loyalty points', 400);
    }

    const pointValue = siteSettings?.loyaltyPointRupeeValue ?? 1;
    loyaltyPointsApplied = loyaltyPoints;
    loyaltyDiscount = loyaltyPointsApplied * pointValue;
  }

  const totalAmount = subtotal - couponDiscount - loyaltyDiscount + deliveryCharge;

  // 5. Create Razorpay Order
  const rpOrder = await razorpay.orders.create({
    amount: Math.round(totalAmount * 100), // Convert to paise
    currency: 'INR',
    receipt: `rcpt_${Date.now()}`,
    notes: {
      userId,
      storeId: resolvedStoreId,
    },
  });

  // 6. Create Draft Order in DB
  const orderNumber = await (Order as any).generateOrderNumber();
  const order = await Order.create({
    orderNumber,
    userId,
    storeId: resolvedStoreId,
    serviceMode,
    items: validatedItems,
    subtotal,
    couponCode,
    couponDiscount,
    loyaltyPointsApplied,
    loyaltyDiscount,
    deliveryCharge,
    totalAmount,
    shippingAddress,
    paymentStatus: 'pending',
    paymentMethod: 'razorpay',
    razorpayOrderId: rpOrder.id,
    status: 'placed',
  });

  return {
    razorpayOrderId: rpOrder.id,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    amount: totalAmount,
    currency: 'INR',
    storeId: resolvedStoreId,
    orderSummary: {
      subtotal,
      couponDiscount,
      loyaltyPointsApplied,
      loyaltyDiscount,
      deliveryCharge,
      totalAmount,
      items: validatedItems,
    },
    orderId: order._id,
  };
}

/**
 * Places a COD order directly without Razorpay payment creation.
 *
 * @param userId - ID of the authenticated user
 * @param input - Order data from frontend
 */
export async function placeCodOrder(userId: string, input: any) {
  const { storeId, items, serviceMode, couponCode, shippingAddress, loyaltyPoints } = input;

  if (serviceMode === 'delivery' && !shippingAddress) {
    throw new AppError('Shipping address is required for delivery orders', 400);
  }

  const resolvedStoreId = await resolveStoreIdForOrder(items, serviceMode, storeId);

  const store = await Store.findById(resolvedStoreId);
  if (!store || !store.isActive) {
    throw new AppError('Store not found or inactive', 400);
  }

  const { subtotal, validatedItems } = await calculateCart(items, resolvedStoreId);

  let couponDiscount = 0;
  let validatedCoupon: any = null;
  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, resolvedStoreId, subtotal, userId);
    if (!couponResult.valid) {
      throw new AppError(couponResult.message, 400);
    }
    couponDiscount = couponResult.discount!;
    validatedCoupon = couponResult.coupon;
  }

  const siteSettingsForCOD = await SiteSetting.findOne({ singletonKey: 'default' });
  const thresholdForCOD = siteSettingsForCOD?.freeDeliveryThreshold ?? 1000;
  const chargeForCOD = siteSettingsForCOD?.standardDeliveryCharge ?? 50;

  const deliveryCharge = serviceMode === 'delivery' ? (subtotal >= thresholdForCOD ? 0 : chargeForCOD) : 0;
  
  let loyaltyDiscount = 0;
  let loyaltyPointsApplied = 0;
  if (loyaltyPoints > 0) {
    const user = await User.findById(userId);
    if (!user || user.loyaltyPoints < loyaltyPoints) {
      throw new AppError('Insufficient loyalty points', 400);
    }
    const pointValue = siteSettingsForCOD?.loyaltyPointRupeeValue ?? 1;
    loyaltyPointsApplied = loyaltyPoints;
    loyaltyDiscount = loyaltyPointsApplied * pointValue;
  }

  const totalAmount = subtotal - couponDiscount - loyaltyDiscount + deliveryCharge;

  const orderNumber = await (Order as any).generateOrderNumber();
  const order = await Order.create({
    orderNumber,
    userId,
    storeId: resolvedStoreId,
    serviceMode,
    items: validatedItems,
    subtotal,
    couponCode,
    couponDiscount,
    loyaltyPointsApplied,
    loyaltyDiscount,
    deliveryCharge,
    totalAmount,
    shippingAddress,
    paymentStatus: 'pending',
    paymentMethod: 'cod',
    status: 'placed',
  });

  if (validatedCoupon) {
    await validatedCoupon.updateOne({ $inc: { usedCount: 1 } });
  }

  for (const item of items) {
    const inventoryRow = await DealerInventory.findOne({
      storeId: resolvedStoreId,
      productId: item.productId,
      variantId: item.variantId,
    });

    if (inventoryRow) {
      inventoryRow.quantity = Math.max(0, inventoryRow.quantity - item.qty);
      await inventoryRow.save();
    } else {
      await Product.updateOne(
        { _id: item.productId, 'variants._id': item.variantId },
        {
          $inc: {
            'variants.$.stock': -item.qty,
            totalSold: item.qty,
          },
        }
      );
    }

    await Product.updateOne(
      { _id: item.productId },
      {
        $inc: {
          totalSold: item.qty,
        },
      },
    );
  }

  if (loyaltyPointsApplied > 0) {
    await User.findByIdAndUpdate(userId, { $inc: { loyaltyPoints: -loyaltyPointsApplied } });
  }

  const user = await User.findById(userId);
  if (user && user.email) {
    const html = orderPlacedTemplate(order, user);
    addEmailToQueue({
      to: user.email,
      subject: `Order Confirmed - ${orderNumber}`,
      html,
    });
  }

  const populatedStore = await Store.findById(resolvedStoreId).populate('adminId');
  if (populatedStore && populatedStore.adminId && (populatedStore.adminId as any).email) {
    addEmailToQueue({
      to: (populatedStore.adminId as any).email,
      subject: `New COD Order Received - ${orderNumber}`,
      html: `<h3>New COD order received for ${populatedStore.name}</h3><p>Order Number: ${orderNumber}</p><p>Total: ₹${order.totalAmount}</p>`,
    });
  }

  // Notify Superadmins
  const superadmins = await User.find({ role: 'superadmin', isActive: true }).select('email');
  for (const admin of superadmins) {
    if (admin.email) {
      addEmailToQueue({
        to: admin.email,
        subject: `[SYSTEM] New COD Order - ${orderNumber}`,
        html: `<h3>New COD order received in the system</h3><p>Store: ${populatedStore?.name || 'Unknown'}</p><p>Order Number: ${orderNumber}</p><p>Total: ₹${order.totalAmount}</p>`,
      });
    }
  }

  return { orderId: order._id, orderNumber };
}

/**
 * Finalizes an order after successful payment.
 * This function is idempotent and handles stock decrement and notifications.
 */
export async function finalizeOrder(razorpayOrderId: string, paymentId: string, signature?: string) {
  const order = await Order.findOne({ razorpayOrderId });
  if (!order) {
    console.warn(`[ORDER] Finalization failed: Order not found for RP ID ${razorpayOrderId}`);
    return null;
  }

  if (order.paymentStatus === 'paid') {
    return order;
  }

  // 1. Update status
  order.paymentStatus = 'paid';
  order.razorpayPaymentId = paymentId;
  if (signature) {
    order.razorpaySignature = signature;
  }
  await order.save();

  // 2. Decrement Stock
  for (const item of order.items) {
    const inventoryRow = await DealerInventory.findOne({
      storeId: order.storeId,
      productId: item.productId,
      variantId: item.variantId,
    });

    if (inventoryRow) {
      inventoryRow.quantity = Math.max(0, inventoryRow.quantity - item.qty);
      await inventoryRow.save();
    } else {
      await Product.updateOne(
        { _id: item.productId, 'variants._id': item.variantId },
        {
          $inc: {
            'variants.$.stock': -item.qty,
          },
        }
      );
    }

    await Product.updateOne(
      { _id: item.productId },
      {
        $inc: {
          totalSold: item.qty,
        },
      },
    );
  }

  // 2.5 Deduct Loyalty Points
  if (order.loyaltyPointsApplied > 0) {
    await User.findByIdAndUpdate(order.userId, { $inc: { loyaltyPoints: -order.loyaltyPointsApplied } });
  }

  // 3. Update Coupon
  if (order.couponCode) {
    await mongoose.model('Coupon').updateOne(
      { code: order.couponCode },
      { $inc: { usedCount: 1 } }
    );
  }

  // 4. Send Email Notifications (Async)
  const user = await User.findById(order.userId);
  if (user && user.email) {
    const html = orderPlacedTemplate(order as any, user);
    addEmailToQueue({
      to: user.email,
      subject: `Order Confirmed - ${order.orderNumber}`,
      html,
    });
  }

  // Notify Store Admin
  const store = await Store.findById(order.storeId).populate('adminId');
  if (store && store.adminId && (store.adminId as any).email) {
    addEmailToQueue({
      to: (store.adminId as any).email,
      subject: `New Order Received - ${order.orderNumber}`,
      html: `<h3>New order received for ${store.name}</h3><p>Order Number: ${order.orderNumber}</p><p>Total: ₹${order.totalAmount}</p>`,
    });
  }

  // Notify Superadmins
  const superadmins = await User.find({ role: 'superadmin', isActive: true }).select('email');
  for (const admin of superadmins) {
    if (admin.email) {
      addEmailToQueue({
        to: admin.email,
        subject: `[SYSTEM] New Order - ${order.orderNumber}`,
        html: `<h3>New order received in the system</h3><p>Store: ${store?.name || 'Unknown'}</p><p>Order Number: ${order.orderNumber}</p><p>Total: ₹${order.totalAmount}</p>`,
      });
    }
  }

  return order;
}

/**
 * Confirms an order by verifying Razorpay signature and finalising the DB record.
 * 
 * @param userId - ID of the authenticated user
 * @param input - Confirmation data (Razorpay details)
 */
export async function confirmOrder(userId: string, input: any) {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = input;

  // 1. Verify Razorpay Signature
  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  const body = razorpayOrderId + '|' + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body.toString())
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    throw new AppError('Invalid payment signature. Potential fraud detected.', 400);
  }

  // 2. Finalize Order
  const order = await finalizeOrder(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!order) {
    throw new AppError('Order not found. Invalid Razorpay Order ID.', 404);
  }

  return { orderId: order._id, orderNumber: order.orderNumber };
}

/**
 * Returns paginated orders for the authenticated customer.
 */
export async function getMyOrders(userId: string, query: any) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, any> = { userId };
  applyVisibleOrderFilter(filter);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  return createPaginationResponse(orders, total, page, limit);
}

/**
 * Returns a single order detail if it belongs to the user.
 */
export async function getOrderDetail(orderId: string, userId: string) {
  const filter: Record<string, any> = { _id: orderId, userId };
  applyVisibleOrderFilter(filter);

  const order = await Order.findOne(filter).populate('storeId', 'name address phone');
  if (!order) {
    throw new AppError('Order not found', 404);
  }
  return order;
}

/**
 * Allows a customer to cancel an order if it's still in 'placed' or 'confirmed' status.
 */
export async function cancelOrder(orderId: string, userId: string) {
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) {
    throw new AppError('Order not found', 404);
  }

  if (!['placed', 'confirmed'].includes(order.status)) {
    throw new AppError(`Cannot cancel order in ${order.status} status`, 400);
  }

  order.status = 'cancelled';
  order.statusHistory.push({
    status: 'cancelled',
    note: 'Cancelled by customer',
    timestamp: new Date(),
  });

  // Revert stock? Optionally implement this logic
  
  await order.save();
  return order;
}

// ─── Admin Services ──────────────────────────────────────────────────────

/**
 * Returns paginated orders for a store admin.
 */
export async function getAdminOrders(storeId: string, query: any) {
  const { page, limit, skip } = parsePagination(query);
  const filter: any = { storeId };

  if (query.status) filter.status = query.status;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
  if (query.search) {
    filter.orderNumber = { $regex: query.search, $options: 'i' };
  }
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
  }
  applyVisibleOrderFilter(filter);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('userId', 'name mobile email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  return createPaginationResponse(orders, total, page, limit);
}

export async function getAdminOrderDetail(orderId: string, storeId: string) {
  const filter: Record<string, any> = { _id: orderId, storeId };
  applyVisibleOrderFilter(filter);

  const order = await Order.findOne(filter)
    .populate('userId', 'name mobile email savedAddress')
    .populate('storeId', 'name address phone email');

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  return order;
}

/**
 * Returns paginated orders for super admin.
 */
export async function getSuperAdminOrders(query: any) {
  const { page, limit, skip } = parsePagination(query);
  const filter: any = {};

  if (query.status) filter.status = query.status;
  if (query.storeId) filter.storeId = query.storeId;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
  
  if (query.search) {
    filter.orderNumber = { $regex: query.search, $options: 'i' };
  }

  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
  }
  applyVisibleOrderFilter(filter);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('userId', 'name mobile')
      .populate('storeId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  return createPaginationResponse(orders, total, page, limit);
}

/**
 * Updates an order's status and notifies the customer.
 */
export async function updateOrderStatus(orderId: string, input: any, adminId: string) {
  const { status, note } = input;
  const order = await Order.findById(orderId);

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  order.status = status;
  order.statusHistory.push({
    status,
    note,
    updatedBy: adminId as any,
    timestamp: new Date(),
  });

  await order.save();

  // Send Email Notification to Customer
  const user = await User.findById(order.userId);
  if (user && user.email) {
    const html = orderStatusUpdateTemplate(order, user, status, note);
    addEmailToQueue({
      to: user.email,
      subject: `Order Update - ${order.orderNumber}: ${status.toUpperCase()}`,
      html,
    });
  }

  if (user?.expoPushToken) {
    await sendExpoPushNotification({
      to: user.expoPushToken,
      title: `Order ${status}`,
      body: `Your order ${order.orderNumber} is now ${status}.`,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status,
      },
    });
  }

  return order;
}
