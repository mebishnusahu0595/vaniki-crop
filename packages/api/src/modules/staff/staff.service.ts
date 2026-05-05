import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Staff } from '../../models/Staff.model.js';
import { User } from '../../models/User.model.js';
import { Order } from '../../models/Order.model.js';
import { AppError } from '../../utils/AppError.js';
import { uploadToCloudinary } from '../../utils/cloudinary.helpers.js';

export const DELIVERY_CANCEL_REASONS = [
  'Customer not available',
  'Customer refused delivery',
  'Wrong address',
  'Unable to contact customer',
  'Payment not received',
  'Product damaged',
  'Other',
] as const;

const STAFF_ACCESS_TOKEN_EXPIRES = '7d';

function generateDeliveryOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

function normalizeStaff(staff: any) {
  const json = typeof staff.toJSON === 'function' ? staff.toJSON() : staff;
  return {
    ...json,
    id: json.id || json._id?.toString(),
  };
}

function createStaffToken(staff: any) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('JWT_SECRET is not configured', 500);
  }

  return jwt.sign(
    {
      staffId: staff._id.toString(),
      role: 'staff',
    },
    secret,
    { expiresIn: STAFF_ACCESS_TOKEN_EXPIRES },
  );
}

function getStaffOrderQuery(staffId: string) {
  return {
    assignedStaff: staffId,
    serviceMode: 'delivery',
    $or: [
      { paymentMethod: 'cod' },
      { paymentStatus: 'paid' },
    ],
  };
}

function orderPopulate(query: any) {
  return query
    .select('+deliveryOtp')
    .populate('userId', 'name mobile email savedAddress')
    .populate('storeId', 'name address phone email')
    .populate('assignedStaff', 'name mobile email isActive');
}

export async function createStaff(payload: { name: string; mobile: string; email?: string; password?: string; role?: 'delivery' | 'referral' }) {
  if (!payload.password || payload.password.length < 6) {
    throw new AppError('Staff password must be at least 6 characters', 400);
  }
  return Staff.create(payload);
}

export async function listStaff(query: { role?: string } = {}) {
  const filter: any = {};
  if (query.role) filter.role = query.role;

  const staff = await Staff.find(filter).sort({ createdAt: -1 });
  
  // Get referral counts for each staff
  const staffWithStats = await Promise.all(
    staff.map(async (s) => {
      const [count, activeDeliveries, deliveredDeliveries, cancelledDeliveries] = await Promise.all([
        User.countDocuments({ referredByStaff: s._id }),
        Order.countDocuments({ assignedStaff: s._id, status: { $nin: ['delivered', 'cancelled'] } }),
        Order.countDocuments({ assignedStaff: s._id, status: 'delivered' }),
        Order.countDocuments({ assignedStaff: s._id, status: 'cancelled' }),
      ]);
      return {
        ...normalizeStaff(s),
        referralCount: count,
        activeDeliveries,
        deliveredDeliveries,
        cancelledDeliveries,
      };
    })
  );
  
  return staffWithStats;
}

export async function getStaffReferrals(staffId: string) {
  const users = await User.find({ referredByStaff: staffId })
    .select('name mobile email createdAt savedAddress')
    .sort({ createdAt: -1 });

  const usersWithOrders = await Promise.all(
    users.map(async (user) => {
      const orders = await Order.find({ userId: user._id, status: { $ne: 'cancelled' } })
        .select('orderNumber items totalAmount createdAt status')
        .sort({ createdAt: -1 });
      
      return {
        ...user.toJSON(),
        orders
      };
    })
  );

  return usersWithOrders;
}

export async function getStaffDetail(staffId: string) {
  const staff = await Staff.findById(staffId);
  if (!staff) {
    throw new AppError('Staff not found', 404);
  }

  const [referralCount, deliveries] = await Promise.all([
    User.countDocuments({ referredByStaff: staff._id }),
    orderPopulate(
      Order.find({ assignedStaff: staffId })
        .sort({ deliveryAssignedAt: -1, createdAt: -1 })
        .limit(100),
    ),
  ]);

  return {
    staff: {
      ...normalizeStaff(staff),
      referralCount,
    },
    deliveries,
  };
}

export async function updateStaffStatus(staffId: string, isActive: boolean) {
  return Staff.findByIdAndUpdate(staffId, { isActive }, { new: true });
}

export async function deleteStaff(staffId: string) {
  return Staff.findByIdAndDelete(staffId);
}

export async function loginStaff(payload: { mobile: string; password: string }) {
  const staff = await Staff.findOne({ mobile: payload.mobile }).select('+password');
  if (!staff) {
    throw new AppError('Invalid mobile number or password', 401);
  }
  if (!staff.isActive) {
    throw new AppError('This staff account is inactive', 403);
  }

  const isMatch = await staff.comparePassword(payload.password);
  if (!isMatch) {
    throw new AppError('Invalid mobile number or password', 401);
  }

  return {
    staff: normalizeStaff(staff),
    accessToken: createStaffToken(staff),
  };
}

export async function getStaffSession(staffId: string) {
  const staff = await Staff.findById(staffId);
  if (!staff || !staff.isActive) {
    throw new AppError('Staff account not found or inactive', 401);
  }

  return normalizeStaff(staff);
}

export async function listAvailableDeliveryOrders() {
  return orderPopulate(
    Order.find({
      serviceMode: 'delivery',
      status: { $nin: ['delivered', 'cancelled'] },
      assignedStaff: null,
      $or: [
        { paymentMethod: 'cod' },
        { paymentStatus: 'paid' },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(200),
  );
}

export async function assignDelivery(staffId: string, payload: { orderId: string; deliveryOtp?: string; note?: string }, adminId?: string) {
  const staff = await Staff.findById(staffId);
  if (!staff || !staff.isActive) {
    throw new AppError('Active staff not found', 404);
  }

  const order = await Order.findById(payload.orderId).select('+deliveryOtp');
  if (!order) {
    throw new AppError('Order not found', 404);
  }
  if (order.serviceMode !== 'delivery') {
    throw new AppError('Only delivery orders can be assigned to delivery staff', 400);
  }
  if (['delivered', 'cancelled'].includes(order.status)) {
    throw new AppError('Completed or cancelled orders cannot be assigned', 400);
  }

  const requestedOtp = String(payload.deliveryOtp || '').trim();
  if (requestedOtp && !/^\d{4,6}$/.test(requestedOtp)) {
    throw new AppError('Delivery OTP must be 4 to 6 digits', 400);
  }

  order.assignedStaff = staff._id as any;
  order.deliveryOtp = requestedOtp || order.deliveryOtp || generateDeliveryOtp();
  order.deliveryOtpGeneratedAt = new Date();
  order.deliveryAssignedAt = new Date();
  if (order.status === 'placed') {
    order.status = 'confirmed';
  }
  order.statusHistory.push({
    status: order.status,
    note: payload.note || `Assigned to ${staff.name} for delivery`,
    updatedBy: adminId as any,
    timestamp: new Date(),
  });

  await order.save();
  return orderPopulate(Order.findById(order._id));
}

export async function listStaffTasks(staffId: string) {
  await getStaffSession(staffId);

  return orderPopulate(
    Order.find({
      ...getStaffOrderQuery(staffId),
      status: { $nin: ['delivered', 'cancelled'] },
    }).sort({ deliveryAssignedAt: -1, createdAt: -1 }),
  );
}

export async function getStaffTask(staffId: string, orderId: string) {
  await getStaffSession(staffId);

  const order = await orderPopulate(Order.findOne({ _id: orderId, ...getStaffOrderQuery(staffId) }));
  if (!order) {
    throw new AppError('Delivery task not found', 404);
  }

  return order;
}

export async function markTaskCompleted(staffId: string, orderId: string, payload: { description?: string }) {
  const order = await getStaffTask(staffId, orderId);
  if (['delivered', 'cancelled'].includes(order.status)) {
    throw new AppError('This task is already closed', 400);
  }

  order.status = 'shipped';
  if (payload.description) {
    order.deliveryProofDescription = payload.description;
  }
  order.statusHistory.push({
    status: 'shipped',
    note: payload.description || 'Delivery man marked the task completed',
    timestamp: new Date(),
  });

  await order.save();
  return getStaffTask(staffId, orderId);
}

export async function deliverTask(
  staffId: string,
  orderId: string,
  payload: { otp: string; description?: string },
  file?: Express.Multer.File,
) {
  const order = await getStaffTask(staffId, orderId);
  if (order.status === 'delivered') {
    throw new AppError('This order is already delivered', 400);
  }
  if (order.status === 'cancelled') {
    throw new AppError('Cancelled order cannot be delivered', 400);
  }
  if (!order.deliveryOtp || String(payload.otp).trim() !== order.deliveryOtp) {
    throw new AppError('Invalid delivery OTP', 400);
  }

  if (file) {
    const uploaded = await uploadToCloudinary(file.buffer, 'vaniki/delivery-proof');
    order.deliveryProofImage = uploaded;
  }
  if (payload.description) {
    order.deliveryProofDescription = payload.description;
  }

  order.status = 'delivered';
  order.deliveryDeliveredAt = new Date();
  if (order.paymentMethod === 'cod') {
    order.paymentStatus = 'paid';
  }
  order.statusHistory.push({
    status: 'delivered',
    note: payload.description || 'Delivered by delivery staff with OTP verification',
    timestamp: new Date(),
  });

  await order.save();
  return getStaffTask(staffId, orderId);
}

export async function cancelTask(staffId: string, orderId: string, payload: { reason: string; note?: string }) {
  const order = await getStaffTask(staffId, orderId);
  if (['delivered', 'cancelled'].includes(order.status)) {
    throw new AppError('This task is already closed', 400);
  }
  if (!DELIVERY_CANCEL_REASONS.includes(payload.reason as any)) {
    throw new AppError('Please choose a valid cancellation reason', 400);
  }

  order.status = 'cancelled';
  order.deliveryCancelReason = payload.reason;
  order.deliveryCancelNote = payload.note;
  order.deliveryCancelledAt = new Date();
  order.statusHistory.push({
    status: 'cancelled',
    note: payload.note ? `${payload.reason}: ${payload.note}` : payload.reason,
    timestamp: new Date(),
  });

  await order.save();
  return getStaffTask(staffId, orderId);
}
