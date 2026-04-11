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

    // Check if available at selected store
    const isAvailableAtStore = product.storeId.some(id => id.toString() === storeId);
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
      productName: product.name,
      variantLabel: variant.label,
      price: variant.price,
      mrp: variant.mrp,
      qty: item.qty,
      image: product.images.length > 0 ? product.images[0].url : undefined,
    });
  }

  return { subtotal, validatedItems };
}

// ─── Customer Services ───────────────────────────────────────────────────

/**
 * Initiates an order by calculating totals and creating a Razorpay order.
 * 
 * @param userId - ID of the authenticated user
 * @param input - Order data from frontend
 */
export async function initiateOrder(userId: string, input: any) {
  const { storeId, items, serviceMode, couponCode, shippingAddress } = input;

  // 1. Basic validation
  if (serviceMode === 'delivery' && !shippingAddress) {
    throw new AppError('Shipping address is required for delivery orders', 400);
  }

  const store = await Store.findById(storeId);
  if (!store || !store.isActive) {
    throw new AppError('Store not found or inactive', 400);
  }

  // 2. Calculate Subtotal & Validate Stock
  const { subtotal, validatedItems } = await calculateCart(items, storeId);

  // 3. Handle Coupon
  let couponDiscount = 0;
  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, storeId, subtotal);
    if (!couponResult.valid) {
      throw new AppError(couponResult.message, 400);
    }
    couponDiscount = couponResult.discount!;
  }

  // 4. Delivery Charge (Hardcoded for now, can be dynamic based on distance/pincode)
  const deliveryCharge = serviceMode === 'delivery' ? (subtotal > 1000 ? 0 : 50) : 0;

  const totalAmount = subtotal - couponDiscount + deliveryCharge;

  // 5. Create Razorpay Order
  const rpOrder = await razorpay.orders.create({
    amount: Math.round(totalAmount * 100), // Convert to paise
    currency: 'INR',
    receipt: `rcpt_${Date.now()}`,
    notes: {
      userId,
      storeId,
    },
  });

  return {
    razorpayOrderId: rpOrder.id,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    amount: totalAmount,
    currency: 'INR',
    orderSummary: {
      subtotal,
      couponDiscount,
      deliveryCharge,
      totalAmount,
      items: validatedItems,
    },
  };
}

/**
 * Places a COD order directly without Razorpay payment creation.
 *
 * @param userId - ID of the authenticated user
 * @param input - Order data from frontend
 */
export async function placeCodOrder(userId: string, input: any) {
  const { storeId, items, serviceMode, couponCode, shippingAddress } = input;

  if (serviceMode === 'delivery' && !shippingAddress) {
    throw new AppError('Shipping address is required for delivery orders', 400);
  }

  const store = await Store.findById(storeId);
  if (!store || !store.isActive) {
    throw new AppError('Store not found or inactive', 400);
  }

  const { subtotal, validatedItems } = await calculateCart(items, storeId);

  let couponDiscount = 0;
  let validatedCoupon: any = null;
  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, storeId, subtotal);
    if (!couponResult.valid) {
      throw new AppError(couponResult.message, 400);
    }
    couponDiscount = couponResult.discount!;
    validatedCoupon = couponResult.coupon;
  }

  const deliveryCharge = serviceMode === 'delivery' ? (subtotal > 1000 ? 0 : 50) : 0;
  const totalAmount = subtotal - couponDiscount + deliveryCharge;

  const orderNumber = await (Order as any).generateOrderNumber();
  const order = await Order.create({
    orderNumber,
    userId,
    storeId,
    serviceMode,
    items: validatedItems,
    subtotal,
    couponCode,
    couponDiscount,
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
      storeId,
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

  const user = await User.findById(userId);
  if (user && user.email) {
    const html = orderPlacedTemplate(order, user);
    addEmailToQueue({
      to: user.email,
      subject: `Order Confirmed - ${orderNumber}`,
      html,
    });
  }

  const populatedStore = await Store.findById(storeId).populate('adminId');
  if (populatedStore && populatedStore.adminId && (populatedStore.adminId as any).email) {
    addEmailToQueue({
      to: (populatedStore.adminId as any).email,
      subject: `New COD Order Received - ${orderNumber}`,
      html: `<h3>New COD order received for ${populatedStore.name}</h3><p>Order Number: ${orderNumber}</p><p>Total: ₹${order.totalAmount}</p>`,
    });
  }

  return { orderId: order._id, orderNumber };
}

/**
 * Confirms an order by verifying Razorpay signature and creating the DB record.
 * 
 * @param userId - ID of the authenticated user
 * @param input - Confirmation data (Razorpay details + original cart)
 */
export async function confirmOrder(userId: string, input: any) {
  const { 
    razorpayOrderId, razorpayPaymentId, razorpaySignature, 
    items, storeId, serviceMode, couponCode, shippingAddress 
  } = input;

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

  // Check if order already exists (prevent duplicate creation on webhook race)
  const existingOrder = await Order.findOne({ razorpayOrderId });
  if (existingOrder) {
    return { orderId: existingOrder._id, orderNumber: existingOrder.orderNumber };
  }

  // 2. Re-calculate totals (Security measure)
  const { subtotal, validatedItems } = await calculateCart(items, storeId);
  let couponDiscount = 0;
  if (couponCode) {
    const couponResult = await validateCoupon(couponCode, storeId, subtotal);
    if (!couponResult.valid) {
      throw new AppError(couponResult.message, 400);
    }
    couponDiscount = couponResult.discount!;
    // Increment coupon used count
    await couponResult.coupon!.updateOne({ $inc: { usedCount: 1 } });
  }
  const deliveryCharge = serviceMode === 'delivery' ? (subtotal > 1000 ? 0 : 50) : 0;
  const totalAmount = subtotal - couponDiscount + deliveryCharge;

  // 3. Create Order
  const orderNumber = await (Order as any).generateOrderNumber();
  const order = await Order.create({
    orderNumber,
    userId,
    storeId,
    serviceMode,
    items: validatedItems,
    subtotal,
    couponCode,
    couponDiscount,
    deliveryCharge,
    totalAmount,
    shippingAddress,
    paymentStatus: 'paid', // Confirming from successful Razorpay UI
    paymentMethod: 'razorpay',
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    status: 'placed',
  });

  // 4. Decrement Stock
  for (const item of items) {
    const inventoryRow = await DealerInventory.findOne({
      storeId,
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

  // 5. Send Email Notifications (Async)
  const user = await User.findById(userId);
  if (user && user.email) {
    const html = orderPlacedTemplate(order, user);
    addEmailToQueue({
      to: user.email,
      subject: `Order Confirmed - ${orderNumber}`,
      html,
    });
  }

  // Notify Store Admin
  const store = await Store.findById(storeId).populate('adminId');
  if (store && store.adminId && (store.adminId as any).email) {
    // Basic notification for admin, could use a separate template
    addEmailToQueue({
      to: (store.adminId as any).email,
      subject: `New Order Received - ${orderNumber}`,
      html: `<h3>New order received for ${store.name}</h3><p>Order Number: ${orderNumber}</p><p>Total: ₹${order.totalAmount}</p>`,
    });
  }

  return { orderId: order._id, orderNumber };
}

/**
 * Returns paginated orders for the authenticated customer.
 */
export async function getMyOrders(userId: string, query: any) {
  const { page, limit, skip } = parsePagination(query);

  const [orders, total] = await Promise.all([
    Order.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments({ userId }),
  ]);

  return createPaginationResponse(orders, total, page, limit);
}

/**
 * Returns a single order detail if it belongs to the user.
 */
export async function getOrderDetail(orderId: string, userId: string) {
  const order = await Order.findOne({ _id: orderId, userId }).populate('storeId', 'name address phone');
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
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
  if (query.search) {
    filter.orderNumber = { $regex: query.search, $options: 'i' };
  }
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
  }

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
  const order = await Order.findOne({ _id: orderId, storeId })
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
