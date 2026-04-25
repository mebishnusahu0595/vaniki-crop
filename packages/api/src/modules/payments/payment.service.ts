import { Payment, type IPayment } from '../../models/Payment.model.js';
import { Order } from '../../models/Order.model.js';
import { createPaginationResponse, parsePagination } from '../../utils/pagination.js';
import { finalizeOrder } from '../orders/order.service.js';

/**
 * Handles processed Razorpay webhook events.
 */
export async function handleWebhookEvent(event: string, payload: any) {
  const paymentData = payload.payment.entity;
  const razorpayOrderId = paymentData.order_id;
  const razorpayPaymentId = paymentData.id;

  const linkedOrder = await Order.findOne({ razorpayOrderId }).select('_id userId storeId');
  if (!linkedOrder) {
    console.warn(`[PAYMENT] No order found for Razorpay order: ${razorpayOrderId}`);
    return;
  }

  // 1. Log or Update Payment Record
  let payment = await Payment.findOne({ razorpayPaymentId });
  
  if (!payment) {
    payment = new Payment({
      orderId: linkedOrder._id,
      userId: linkedOrder.userId,
      storeId: linkedOrder.storeId,
      razorpayOrderId,
      razorpayPaymentId,
      amount: paymentData.amount / 100,
      currency: paymentData.currency,
      method: paymentData.method,
      status: 'pending',
    });
  }

  // Backfill references for old rows if needed.
  if (!payment.orderId) payment.orderId = linkedOrder._id;
  if (!payment.userId) payment.userId = linkedOrder.userId;
  if (!payment.storeId) payment.storeId = linkedOrder.storeId;

  // 2. Handle specific events
  switch (event) {
    case 'payment.captured':
      payment.status = 'captured';
      await finalizeOrder(razorpayOrderId, razorpayPaymentId);
      break;

    case 'payment.failed':
      payment.status = 'failed';
      await Order.updateOne(
        { razorpayOrderId },
        { paymentStatus: 'failed' }
      );
      break;

    case 'refund.processed':
      payment.status = 'refunded';
      await Order.updateOne(
        { razorpayOrderId },
        { paymentStatus: 'refunded' }
      );
      break;
  }

  await payment.save();
}

/**
 * Returns paginated payments for super admin.
 */
export async function getSuperAdminPayments(query: any) {
  const { page, limit, skip } = parsePagination(query);
  const filter: any = {};

  if (query.status) filter.status = query.status;
  if (query.method) filter.method = query.method;
  
  if (query.startDate && query.endDate) {
    filter.createdAt = {
      $gte: new Date(query.startDate),
      $lte: new Date(query.endDate),
    };
  }

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);

  return createPaginationResponse(payments, total, page, limit);
}

/**
 * Returns filtered payments for a specific store.
 * Note: Payment model doesn't directly have storeId in this schema, 
 * so we link through Order if needed, but for simplicity we'll filter by RP Order ID.
 */
export async function getAdminPayments(storeId: string, query: any) {
  const { page, limit, skip } = parsePagination(query);
  
  // Find all orders for this store to get their Razorpay Order IDs
  const storeOrders = await Order.find({ storeId }).select('razorpayOrderId');
  const rpOrderIds = storeOrders.map(o => o.razorpayOrderId).filter(Boolean);

  const filter: any = { razorpayOrderId: { $in: rpOrderIds } };
  if (query.status) filter.status = query.status;

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);

  return createPaginationResponse(payments, total, page, limit);
}
