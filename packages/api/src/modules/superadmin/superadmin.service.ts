import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { createPaginationResponse, parsePagination } from '../../utils/pagination.js';
import { deleteFromCloudinary, uploadImageUrlToCloudinary, uploadToCloudinary } from '../../utils/cloudinary.helpers.js';
import { invalidateHomepageCache } from '../../utils/cache.helpers.js';
import { decryptStoreSecret, encryptStoreSecret, maskSecret } from '../../utils/storeSecrets.js';
import { Store } from '../../models/Store.model.js';
import { User } from '../../models/User.model.js';
import { Order } from '../../models/Order.model.js';
import { Product } from '../../models/Product.model.js';
import { ProductRequest } from '../../models/ProductRequest.model.js';
import { Testimonial } from '../../models/Testimonial.model.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import { StoreSecret } from '../../models/StoreSecret.model.js';
import * as orderService from '../orders/order.service.js';

const STORE_COLORS = ['#2D6A4F', '#52B788', '#40916C', '#74C69D', '#95D5B2', '#1B4332', '#0B6E4F', '#6A994E'];

function parseRange(range?: string): { label: '30d' | '60d' | '90d'; days: number } {
  if (range === '60d') return { label: '60d', days: 60 };
  if (range === '90d') return { label: '90d', days: 90 };
  return { label: '30d', days: 30 };
}

function getDateRange(days: number): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function createDateSeries(days: number): string[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const values: string[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const point = new Date(now);
    point.setDate(point.getDate() - index);
    values.push(point.toISOString().slice(0, 10));
  }

  return values;
}

function toObjectId(value: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

function mapPaymentStatusToDashboardStatus(status: string): 'pending' | 'captured' | 'failed' | 'refunded' {
  if (status === 'paid') return 'captured';
  if (status === 'failed') return 'failed';
  if (status === 'refunded') return 'refunded';
  return 'pending';
}

function toNumericExpression(input: string): Record<string, unknown> {
  return {
    $convert: {
      input,
      to: 'double',
      onError: 0,
      onNull: 0,
    },
  };
}

function applyDateRangeFilter(
  filter: Record<string, any>,
  startDate?: string,
  endDate?: string,
): void {
  if (!startDate && !endDate) return;

  filter.createdAt = {};
  if (startDate) {
    filter.createdAt.$gte = new Date(startDate);
  }
  if (endDate) {
    const inclusiveEndDate = new Date(endDate);
    inclusiveEndDate.setHours(23, 59, 59, 999);
    filter.createdAt.$lte = inclusiveEndDate;
  }
}

function maskEncryptedSecrets(secrets: Map<string, string> | Record<string, string> | undefined | null): Record<string, string> {
  if (!secrets) return {};

  const entries = secrets instanceof Map ? Array.from(secrets.entries()) : Object.entries(secrets);
  const masked: Record<string, string> = {};

  for (const [key, encryptedValue] of entries) {
    if (!encryptedValue) continue;

    try {
      const decrypted = decryptStoreSecret(encryptedValue);
      masked[key] = maskSecret(decrypted);
    } catch {
      masked[key] = '********';
    }
  }

  return masked;
}

export async function getAnalytics(query: Record<string, any>) {
  const range = parseRange(query.range);
  const sinceDate = getDateRange(range.days);
  const dateSeries = createDateSeries(range.days);

  const [
    totalRevenueAgg,
    totalOrders,
    totalCustomers,
    activeProducts,
    revenueByStoreAgg,
    timelineAgg,
    orderStatusAgg,
    topProducts,
  ] = await Promise.all([
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, totalRevenue: { $sum: toNumericExpression('$totalAmount') } } },
    ]),
    Order.countDocuments(),
    User.countDocuments({ role: 'customer', isActive: true }),
    Product.countDocuments({ isActive: true }),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $group: {
          _id: '$storeId',
          revenue: { $sum: toNumericExpression('$totalAmount') },
          orders: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'stores',
          localField: '_id',
          foreignField: '_id',
          as: 'store',
        },
      },
      {
        $unwind: {
          path: '$store',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          storeId: '$_id',
          storeName: { $ifNull: ['$store.name', 'Unknown Store'] },
          revenue: 1,
          orders: 1,
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: sinceDate } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            storeId: '$storeId',
          },
          revenue: { $sum: toNumericExpression('$totalAmount') },
        },
      },
      {
        $lookup: {
          from: 'stores',
          localField: '_id.storeId',
          foreignField: '_id',
          as: 'store',
        },
      },
      {
        $unwind: {
          path: '$store',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          storeId: '$_id.storeId',
          storeName: { $ifNull: ['$store.name', 'Unknown Store'] },
          revenue: 1,
        },
      },
      { $sort: { date: 1 } },
    ]),
    Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            productId: '$items.productId',
            storeId: '$storeId',
          },
          productName: { $first: '$items.productName' },
          unitsSold: { $sum: toNumericExpression('$items.qty') },
          revenue: {
            $sum: {
              $multiply: [toNumericExpression('$items.qty'), toNumericExpression('$items.price')],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'stores',
          localField: '_id.storeId',
          foreignField: '_id',
          as: 'store',
        },
      },
      {
        $unwind: {
          path: '$store',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          productName: 1,
          storeName: { $ifNull: ['$store.name', 'Unknown Store'] },
          unitsSold: 1,
          revenue: 1,
        },
      },
      { $sort: { unitsSold: -1, revenue: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const revenueByStore = revenueByStoreAgg.map((entry: any, index: number) => ({
    ...entry,
    storeId: entry.storeId?.toString(),
    color: STORE_COLORS[index % STORE_COLORS.length],
  }));

  const storeSeriesMeta = revenueByStore.map((entry) => ({
    storeId: entry.storeId,
    storeName: entry.storeName,
    color: entry.color,
    key: `store_${entry.storeId}`,
  }));

  const timelineMap = new Map<string, any>(
    dateSeries.map((date) => [
      date,
      {
        date,
        totalRevenue: 0,
      },
    ]),
  );

  for (const store of storeSeriesMeta) {
    for (const point of timelineMap.values()) {
      point[store.key] = 0;
    }
  }

  for (const row of timelineAgg) {
    const date = row.date as string;
    const storeId = row.storeId?.toString();
    const key = storeId ? `store_${storeId}` : undefined;

    const target = timelineMap.get(date);
    if (!target) continue;

    target.totalRevenue += row.revenue || 0;
    if (key) {
      target[key] = (target[key] || 0) + (row.revenue || 0);
    }
  }

  const statusTemplate = ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  const statusCountMap = new Map<string, number>(orderStatusAgg.map((entry: any) => [entry._id, entry.count]));

  const orderStatusBreakdown = statusTemplate.map((status) => ({
    status,
    count: statusCountMap.get(status) || 0,
  }));

  return {
    stats: {
      totalRevenue: Math.round((totalRevenueAgg[0]?.totalRevenue || 0) * 100) / 100,
      totalOrders,
      totalCustomers,
      activeProducts,
    },
    revenueByStore,
    revenueTimeline: {
      range: range.label,
      stores: storeSeriesMeta,
      points: Array.from(timelineMap.values()),
    },
    orderStatusBreakdown,
    topProducts,
  };
}

export async function listStores(query: Record<string, any>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, any> = {};

  const rejectedAdminRows = await User.find({
    role: 'storeAdmin',
    approvalStatus: 'rejected',
  }).select('_id');
  const rejectedAdminIds = rejectedAdminRows.map((row) => row._id as mongoose.Types.ObjectId);

  if (rejectedAdminIds.length) {
    filter.adminId = { $nin: rejectedAdminIds };
  }

  if (query.isActive === 'true' || query.isActive === 'false') {
    filter.isActive = query.isActive === 'true';
  }

  if (typeof query.search === 'string' && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { phone: searchRegex },
      { email: searchRegex },
      { 'address.city': searchRegex },
      { 'address.state': searchRegex },
    ];
  }

  const [stores, total] = await Promise.all([
    Store.find(filter)
      .populate('adminId', 'name email mobile isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Store.countDocuments(filter),
  ]);

  const storeIds = stores.map((store) => store._id as mongoose.Types.ObjectId);

  const [orderStats, secretDocs] = await Promise.all([
    storeIds.length
      ? Order.aggregate([
          { $match: { storeId: { $in: storeIds } } },
          {
            $group: {
              _id: '$storeId',
              totalOrders: { $sum: 1 },
              totalRevenue: {
                $sum: {
                  $cond: [{ $eq: ['$paymentStatus', 'paid'] }, toNumericExpression('$totalAmount'), 0],
                },
              },
            },
          },
        ])
      : Promise.resolve([]),
    storeIds.length ? StoreSecret.find({ storeId: { $in: storeIds } }) : Promise.resolve([]),
  ]);

  const orderStatsMap = new Map<string, { totalOrders: number; totalRevenue: number }>();
  for (const row of orderStats as any[]) {
    orderStatsMap.set(row._id.toString(), {
      totalOrders: row.totalOrders || 0,
      totalRevenue: row.totalRevenue || 0,
    });
  }

  const secretMap = new Map<string, Record<string, string>>();
  for (const doc of secretDocs as any[]) {
    secretMap.set(doc.storeId.toString(), maskEncryptedSecrets(doc.secrets));
  }

  const rows = stores.map((store) => {
    const storeId = (store._id as mongoose.Types.ObjectId).toString();
    const stats = orderStatsMap.get(storeId) || { totalOrders: 0, totalRevenue: 0 };
    const admin = store.adminId as any;
    const maskedSecrets = secretMap.get(storeId) || {};

    return {
      ...store.toJSON(),
      admin: admin
        ? {
            id: admin._id?.toString() || admin.id,
            name: admin.name,
            email: admin.email,
            mobile: admin.mobile,
            isActive: admin.isActive,
          }
        : null,
      adminName: admin?.name || 'Unassigned',
      totalOrders: stats.totalOrders,
      totalRevenue: Math.round(stats.totalRevenue * 100) / 100,
      secrets: maskedSecrets,
      hasSecrets: Object.keys(maskedSecrets).length > 0,
    };
  });

  return createPaginationResponse(rows, total, page, limit);
}

async function ensureStoreAdminUser(adminId: string) {
  const admin = await User.findById(adminId);
  if (!admin) {
    throw new AppError('Assigned admin not found', 404);
  }
  if (admin.role !== 'storeAdmin') {
    throw new AppError('Assigned user must be a store admin', 400);
  }
  if (!admin.isActive) {
    throw new AppError('Assigned admin account is inactive', 400);
  }

  return admin;
}

export async function createStore(input: Record<string, any>) {
  await ensureStoreAdminUser(input.adminId);

  const existingStoreForAdmin = await Store.findOne({ adminId: input.adminId, isActive: true });
  if (existingStoreForAdmin) {
    throw new AppError('This admin already manages an active store', 400);
  }

  const store = await Store.create(input);
  await store.populate('adminId', 'name email mobile isActive');
  return store;
}

export async function updateStore(storeId: string, input: Record<string, any>) {
  if (input.adminId) {
    await ensureStoreAdminUser(input.adminId);
  }

  const store = await Store.findByIdAndUpdate(storeId, input, {
    new: true,
    runValidators: true,
  }).populate('adminId', 'name email mobile isActive');

  if (!store) {
    throw new AppError('Store not found', 404);
  }

  return store;
}

export async function toggleStoreActive(storeId: string, isActive: boolean) {
  const store = await Store.findByIdAndUpdate(storeId, { isActive }, { new: true }).populate(
    'adminId',
    'name email mobile isActive',
  );

  if (!store) {
    throw new AppError('Store not found', 404);
  }

  return store;
}

export async function reassignStoreAdmin(storeId: string, adminId: string) {
  await ensureStoreAdminUser(adminId);

  const store = await Store.findByIdAndUpdate(
    storeId,
    { adminId },
    { new: true, runValidators: true },
  ).populate('adminId', 'name email mobile isActive');

  if (!store) {
    throw new AppError('Store not found', 404);
  }

  return store;
}

function toAdminAccountResponse(admin: any, assignedStore: any) {
  const dealerProfile = admin.dealerProfile || {};

  return {
    ...admin.toJSON(),
    assignedStore: assignedStore
      ? {
          id: assignedStore._id?.toString() || assignedStore.id,
          name: assignedStore.name,
          isActive: assignedStore.isActive,
        }
      : null,
    status: admin.isActive ? 'active' : 'inactive',
    approvalStatus: admin.approvalStatus || 'approved',
    storeName: dealerProfile.storeName || '',
    storeLocation: dealerProfile.storeLocation || '',
    longitude: typeof dealerProfile.longitude === 'number' ? dealerProfile.longitude : undefined,
    latitude: typeof dealerProfile.latitude === 'number' ? dealerProfile.latitude : undefined,
    gstNumber: dealerProfile.gstNumber || '',
    sgstNumber: dealerProfile.sgstNumber || '',
  };
}

async function getAssignedStore(adminId: mongoose.Types.ObjectId) {
  return Store.findOne({ adminId }).sort({ createdAt: -1 }).select('name isActive');
}

export async function listAdmins(query: Record<string, any>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, any> = { role: 'storeAdmin' };

  if (query.isActive === 'true' || query.isActive === 'false') {
    filter.isActive = query.isActive === 'true';
  }

  if (typeof query.search === 'string' && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { mobile: searchRegex },
      { email: searchRegex },
      { 'dealerProfile.storeName': searchRegex },
      { 'dealerProfile.gstNumber': searchRegex },
      { 'dealerProfile.sgstNumber': searchRegex },
    ];
  }

  if (query.approvalStatus && ['pending', 'approved', 'rejected'].includes(String(query.approvalStatus))) {
    filter.approvalStatus = String(query.approvalStatus);
  }

  const [admins, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  const adminIds = admins.map((admin) => admin._id as mongoose.Types.ObjectId);
  const assignedStores = adminIds.length
    ? await Store.find({ adminId: { $in: adminIds } }).select('name adminId isActive')
    : [];

  const storeByAdminId = new Map<string, any>();
  for (const store of assignedStores) {
    storeByAdminId.set(store.adminId.toString(), store);
  }

  const rows = admins.map((admin) => {
    const assignedStore = storeByAdminId.get((admin._id as mongoose.Types.ObjectId).toString()) || null;
    return toAdminAccountResponse(admin, assignedStore);
  });

  return createPaginationResponse(rows, total, page, limit);
}

export async function createAdmin(input: Record<string, any>, file?: Express.Multer.File) {
  const existingMobile = await User.findOne({ mobile: input.mobile });
  if (existingMobile) {
    throw new AppError('A user with this mobile already exists', 409);
  }

  const normalizedEmail = input.email ? String(input.email).trim().toLowerCase() : undefined;
  if (normalizedEmail) {
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      throw new AppError('A user with this email already exists', 409);
    }
  }

  if (!file) {
    throw new AppError('Dealer profile image is required', 400);
  }

  const uploadedProfileImage = await uploadToCloudinary(file.buffer, 'vaniki/users/profile');

  const admin = await User.create({
    name: input.name,
    email: normalizedEmail,
    mobile: input.mobile,
    password: input.password,
    role: 'storeAdmin',
    isActive: true,
    approvalStatus: 'approved',
    profileImage: {
      url: uploadedProfileImage.url,
      publicId: uploadedProfileImage.publicId,
    },
    dealerProfile: {
      storeName: input.storeName,
      storeLocation: input.storeLocation,
      longitude: Number(input.longitude),
      latitude: Number(input.latitude),
      gstNumber: String(input.gstNumber).trim().toUpperCase(),
      sgstNumber: String(input.sgstNumber).trim().toUpperCase(),
    },
  });

  let assignedStore: any = null;
  if (input.storeId) {
    const targetStore = await Store.findById(input.storeId);
    if (!targetStore) {
      throw new AppError('Assigned store not found', 404);
    }
    targetStore.adminId = admin._id as mongoose.Types.ObjectId;
    targetStore.phone = admin.mobile;
    if (normalizedEmail) {
      targetStore.email = normalizedEmail;
    }
    await targetStore.save();
    assignedStore = targetStore;
  } else {
    assignedStore = await Store.create({
      name: input.storeName,
      phone: admin.mobile,
      email: normalizedEmail,
      adminId: admin._id,
      isActive: true,
      address: {
        street: input.storeLocation,
        city: 'Pending',
        state: 'Pending',
        pincode: '000000',
      },
      location: {
        type: 'Point',
        coordinates: [Number(input.longitude), Number(input.latitude)],
      },
      deliveryRadius: 10,
    });
  }

  return toAdminAccountResponse(admin, assignedStore);
}

export async function updateAdmin(adminId: string, input: Record<string, any>, file?: Express.Multer.File) {
  const admin = await User.findById(adminId).select('+password');
  if (!admin || admin.role !== 'storeAdmin') {
    throw new AppError('Store admin not found', 404);
  }

  if (input.mobile && input.mobile !== admin.mobile) {
    const existingMobile = await User.findOne({ mobile: input.mobile, _id: { $ne: adminId } });
    if (existingMobile) {
      throw new AppError('Another user already uses this mobile number', 409);
    }
    admin.mobile = input.mobile;
  }

  if (input.email !== undefined) {
    const normalizedEmail = input.email ? String(input.email).trim().toLowerCase() : undefined;
    if (normalizedEmail && normalizedEmail !== admin.email) {
      const existingEmail = await User.findOne({ email: normalizedEmail, _id: { $ne: adminId } });
      if (existingEmail) {
        throw new AppError('Another user already uses this email address', 409);
      }
    }
    admin.email = normalizedEmail || '';
  }

  if (input.name !== undefined) {
    admin.name = input.name;
  }

  if (input.isActive !== undefined) {
    admin.isActive = input.isActive;
  }

  if (input.password) {
    admin.password = input.password;
  }

  if (input.approvalStatus && ['pending', 'approved', 'rejected'].includes(String(input.approvalStatus))) {
    admin.approvalStatus = String(input.approvalStatus) as 'pending' | 'approved' | 'rejected';
    admin.isActive = admin.approvalStatus === 'approved';
  }

  const existingDealerProfile = (admin.dealerProfile || {}) as Record<string, any>;
  const nextDealerProfile = { ...existingDealerProfile };
  let hasDealerProfileChanges = false;

  if (input.storeName !== undefined) {
    nextDealerProfile.storeName = input.storeName;
    hasDealerProfileChanges = true;
  }
  if (input.storeLocation !== undefined) {
    nextDealerProfile.storeLocation = input.storeLocation;
    hasDealerProfileChanges = true;
  }
  if (input.longitude !== undefined) {
    nextDealerProfile.longitude = Number(input.longitude);
    hasDealerProfileChanges = true;
  }
  if (input.latitude !== undefined) {
    nextDealerProfile.latitude = Number(input.latitude);
    hasDealerProfileChanges = true;
  }
  if (input.gstNumber !== undefined) {
    nextDealerProfile.gstNumber = String(input.gstNumber).trim().toUpperCase();
    hasDealerProfileChanges = true;
  }
  if (input.sgstNumber !== undefined) {
    nextDealerProfile.sgstNumber = String(input.sgstNumber).trim().toUpperCase();
    hasDealerProfileChanges = true;
  }

  if (hasDealerProfileChanges) {
    admin.dealerProfile = nextDealerProfile as any;
  }

  if (file) {
    if (admin.profileImage?.publicId) {
      await deleteFromCloudinary(admin.profileImage.publicId);
    }

    const uploadedProfileImage = await uploadToCloudinary(file.buffer, 'vaniki/users/profile');
    admin.profileImage = {
      url: uploadedProfileImage.url,
      publicId: uploadedProfileImage.publicId,
    };
  }

  await admin.save();

  if (input.storeId) {
    const targetStore = await Store.findById(input.storeId);
    if (!targetStore) {
      throw new AppError('Assigned store not found', 404);
    }
    targetStore.adminId = admin._id as mongoose.Types.ObjectId;

    if (input.storeLocation !== undefined) {
      targetStore.address = {
        ...targetStore.address,
        street: input.storeLocation,
      };
    }

    if (input.longitude !== undefined || input.latitude !== undefined) {
      const [currentLongitude, currentLatitude] = targetStore.location.coordinates;
      targetStore.location = {
        type: 'Point',
        coordinates: [
          input.longitude !== undefined ? Number(input.longitude) : currentLongitude,
          input.latitude !== undefined ? Number(input.latitude) : currentLatitude,
        ],
      };
    }

    if (input.storeName !== undefined) {
      targetStore.name = input.storeName;
    }

    if (input.mobile !== undefined) {
      targetStore.phone = input.mobile;
    }

    if (input.email !== undefined) {
      targetStore.email = input.email || undefined;
    }

    await targetStore.save();
  }

  if (input.approvalStatus !== undefined || input.isActive !== undefined) {
    await Store.updateMany({ adminId: admin._id }, { isActive: admin.isActive });
  }

  const assignedStore = await getAssignedStore(admin._id as mongoose.Types.ObjectId);
  return toAdminAccountResponse(admin, assignedStore);
}

export async function deactivateAdmin(adminId: string) {
  const admin = await User.findByIdAndUpdate(
    adminId,
    { isActive: false },
    { new: true },
  );

  if (!admin || admin.role !== 'storeAdmin') {
    throw new AppError('Store admin not found', 404);
  }

  await Store.updateMany({ adminId: admin._id }, { isActive: false });

  const assignedStore = await getAssignedStore(admin._id as mongoose.Types.ObjectId);
  return toAdminAccountResponse(admin, assignedStore);
}

export async function approveAdmin(adminId: string, approvalStatus: 'approved' | 'rejected') {
  const admin = await User.findById(adminId);
  if (!admin || admin.role !== 'storeAdmin') {
    throw new AppError('Store admin not found', 404);
  }

  admin.approvalStatus = approvalStatus;
  admin.isActive = approvalStatus === 'approved';
  await admin.save();

  await Store.updateMany({ adminId: admin._id }, { isActive: admin.isActive });

  const assignedStore = await getAssignedStore(admin._id as mongoose.Types.ObjectId);
  return toAdminAccountResponse(admin, assignedStore);
}

export async function deleteAdmin(adminId: string) {
  const admin = await User.findById(adminId);
  if (!admin || admin.role !== 'storeAdmin') {
    throw new AppError('Store admin not found', 404);
  }

  const stores = await Store.find({ adminId: admin._id }).select('_id');
  const storeIds = stores.map((store) => store._id as mongoose.Types.ObjectId);

  if (storeIds.length) {
    const [orderCount, productCount, requestCount] = await Promise.all([
      Order.countDocuments({ storeId: { $in: storeIds } }),
      Product.countDocuments({ storeId: { $in: storeIds } }),
      ProductRequest.countDocuments({ $or: [{ adminId: admin._id }, { storeId: { $in: storeIds } }] }),
    ]);

    if (orderCount > 0 || productCount > 0 || requestCount > 0) {
      throw new AppError('Cannot delete admin linked to existing store activity. Deactivate or reassign first.', 400);
    }
  }

  if (admin.profileImage?.publicId) {
    await deleteFromCloudinary(admin.profileImage.publicId);
  }

  await Store.deleteMany({ adminId: admin._id });
  await User.deleteOne({ _id: admin._id });
}

export async function listCustomers(query: Record<string, any>) {
  const { page, limit, skip } = parsePagination(query);

  const match: Record<string, any> = { role: 'customer' };
  if (typeof query.search === 'string' && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    match.$or = [{ name: searchRegex }, { mobile: searchRegex }, { email: searchRegex }];
  }

  const [rows, totalCount] = await Promise.all([
    User.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'userId',
          as: 'orders',
        },
      },
      {
        $addFields: {
          orderCount: { $size: '$orders' },
          lastOrderDate: { $max: '$orders.createdAt' },
          totalSpend: {
            $sum: {
              $map: {
                input: '$orders',
                as: 'order',
                in: toNumericExpression('$$order.totalAmount'),
              },
            },
          },
        },
      },
      {
        $project: {
          id: '$_id',
          name: 1,
          mobile: 1,
          email: 1,
          isActive: 1,
          orderCount: 1,
          lastOrderDate: 1,
          totalSpend: 1,
        },
      },
      { $sort: { lastOrderDate: -1, name: 1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    User.countDocuments(match),
  ]);

  return createPaginationResponse(rows, totalCount, page, limit);
}

export async function listOrders(query: Record<string, any>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, any> = {};

  if (query.status) filter.status = query.status;
  if (query.storeId) filter.storeId = query.storeId;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;

  if (typeof query.search === 'string' && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { orderNumber: searchRegex },
      { razorpayPaymentId: searchRegex },
      { razorpayOrderId: searchRegex },
    ];
  }

  applyDateRangeFilter(filter, query.startDate, query.endDate);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('userId', 'name mobile email')
      .populate('storeId', 'name address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  return createPaginationResponse(orders, total, page, limit);
}

export async function getOrderDetail(orderId: string) {
  const order = await Order.findById(orderId)
    .populate('userId', 'name mobile email savedAddress')
    .populate('storeId', 'name address phone email');

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  return order;
}

export async function updateOrderStatus(orderId: string, input: Record<string, any>, adminId: string) {
  return orderService.updateOrderStatus(orderId, input, adminId);
}

export async function listPayments(query: Record<string, any>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, any> = {};

  if (query.storeId) filter.storeId = query.storeId;
  if (query.method) filter.paymentMethod = query.method;

  if (query.status) {
    const statusMap: Record<string, string> = {
      captured: 'paid',
      pending: 'pending',
      failed: 'failed',
      refunded: 'refunded',
    };

    const mapped = statusMap[String(query.status)];
    if (mapped) {
      filter.paymentStatus = mapped;
    }
  }

  if (typeof query.search === 'string' && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { orderNumber: searchRegex },
      { razorpayPaymentId: searchRegex },
      { razorpayOrderId: searchRegex },
    ];
  }

  applyDateRangeFilter(filter, query.startDate, query.endDate);

  const [orders, total, summaryAgg] = await Promise.all([
    Order.find(filter)
      .populate('storeId', 'name')
      .populate('userId', 'name mobile email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
    Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentStatus',
          amount: { $sum: toNumericExpression('$totalAmount') },
        },
      },
    ]),
  ]);

  const summaryMap = new Map<string, number>();
  for (const item of summaryAgg) {
    summaryMap.set(item._id, item.amount || 0);
  }

  const rows = orders.map((order) => {
    const store = order.storeId as any;
    const customer = order.userId as any;

    return {
      id: order.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      store: {
        id: store?._id?.toString() || store?.id,
        name: store?.name || 'Unknown Store',
      },
      customer: {
        id: customer?._id?.toString() || customer?.id,
        name: customer?.name || 'Customer',
        mobile: customer?.mobile,
        email: customer?.email,
      },
      amount: order.totalAmount,
      razorpayId: order.razorpayPaymentId || order.razorpayOrderId || '-',
      method: order.paymentMethod,
      status: mapPaymentStatusToDashboardStatus(order.paymentStatus),
      date: order.createdAt,
      createdAt: order.createdAt,
    };
  });

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
    summary: {
      totalCaptured: Math.round((summaryMap.get('paid') || 0) * 100) / 100,
      totalFailed: Math.round((summaryMap.get('failed') || 0) * 100) / 100,
      totalRefunded: Math.round((summaryMap.get('refunded') || 0) * 100) / 100,
    },
  };
}

export async function listProductRequests(query: Record<string, any>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, any> = {};

  if (query.status && ['pending', 'contacted', 'fulfilled', 'rejected'].includes(String(query.status))) {
    filter.status = String(query.status);
  }

  if (query.storeId && mongoose.Types.ObjectId.isValid(String(query.storeId))) {
    filter.storeId = query.storeId;
  }

  if (typeof query.search === 'string' && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ productName: searchRegex }, { notes: searchRegex }, { requestedPack: searchRegex }];
  }

  const [rows, total] = await Promise.all([
    ProductRequest.find(filter)
      .populate('storeId', 'name phone')
      .populate('adminId', 'name mobile email')
      .populate('productId', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ProductRequest.countDocuments(filter),
  ]);

  return createPaginationResponse(rows, total, page, limit);
}

export async function updateProductRequestStatus(productRequestId: string, input: Record<string, any>) {
  const request = await ProductRequest.findById(productRequestId)
    .populate('storeId', 'name phone')
    .populate('adminId', 'name mobile email')
    .populate('productId', 'name slug');

  if (!request) {
    throw new AppError('Product request not found', 404);
  }

  if (input.status && ['pending', 'contacted', 'fulfilled', 'rejected'].includes(String(input.status))) {
    request.status = String(input.status) as 'pending' | 'contacted' | 'fulfilled' | 'rejected';
  }

  if (typeof input.superAdminNote === 'string') {
    request.superAdminNote = input.superAdminNote.trim() || undefined;
  }

  await request.save();
  return request;
}

export async function listTestimonials(query: Record<string, any>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, any> = {};

  if (query.storeId) {
    filter.storeId = query.storeId;
  }

  if (query.isActive === 'true' || query.isActive === 'false') {
    filter.isActive = query.isActive === 'true';
  }

  if (typeof query.search === 'string' && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ name: searchRegex }, { message: searchRegex }, { designation: searchRegex }];
  }

  const [rows, total] = await Promise.all([
    Testimonial.find(filter)
      .populate('storeId', 'name')
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Testimonial.countDocuments(filter),
  ]);

  return createPaginationResponse(rows, total, page, limit);
}

export async function createTestimonial(input: Record<string, any>, file?: Express.Multer.File) {
  let avatar: { url: string; publicId: string } | undefined;
  const avatarUrl = typeof input.avatarUrl === 'string' ? input.avatarUrl.trim() : '';

  if (file) {
    avatar = await uploadToCloudinary(file.buffer, 'vaniki/testimonials');
  } else if (avatarUrl) {
    avatar = await uploadImageUrlToCloudinary(avatarUrl, 'vaniki/testimonials');
  }

  const testimonial = await Testimonial.create({
    name: input.name,
    designation: input.designation,
    message: input.message,
    rating: input.rating,
    storeId: input.storeId || null,
    sortOrder: input.sortOrder || 0,
    isActive: input.isActive ?? true,
    avatar,
  });

  await invalidateHomepageCache(input.storeId || undefined);
  await testimonial.populate('storeId', 'name');
  return testimonial;
}

export async function updateTestimonial(
  testimonialId: string,
  input: Record<string, any>,
  file?: Express.Multer.File,
) {
  const testimonial = await Testimonial.findById(testimonialId);
  if (!testimonial) {
    throw new AppError('Testimonial not found', 404);
  }
  const avatarUrl = typeof input.avatarUrl === 'string' ? input.avatarUrl.trim() : '';

  if (file || avatarUrl) {
    if (testimonial.avatar?.publicId) {
      await deleteFromCloudinary(testimonial.avatar.publicId);
    }

    testimonial.avatar = file
      ? await uploadToCloudinary(file.buffer, 'vaniki/testimonials')
      : await uploadImageUrlToCloudinary(avatarUrl, 'vaniki/testimonials');
  }

  const fields: Array<keyof typeof input> = ['name', 'designation', 'message', 'rating', 'sortOrder', 'isActive'];
  for (const field of fields) {
    if (input[field] !== undefined) {
      (testimonial as any)[field] = input[field];
    }
  }

  if (input.storeId !== undefined) {
    testimonial.storeId = input.storeId || null;
  }

  await testimonial.save();
  await invalidateHomepageCache(testimonial.storeId?.toString());

  await testimonial.populate('storeId', 'name');
  return testimonial;
}

export async function toggleTestimonial(testimonialId: string, isActive: boolean) {
  const testimonial = await Testimonial.findByIdAndUpdate(
    testimonialId,
    { isActive },
    { new: true },
  ).populate('storeId', 'name');

  if (!testimonial) {
    throw new AppError('Testimonial not found', 404);
  }

  await invalidateHomepageCache(testimonial.storeId?.toString());
  return testimonial;
}

export async function reorderTestimonials(input: Array<{ id: string; sortOrder: number }>) {
  if (!input.length) {
    return { success: true };
  }

  await Testimonial.bulkWrite(
    input.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { $set: { sortOrder: item.sortOrder } },
      },
    })),
  );

  await invalidateHomepageCache();
  return { success: true };
}

export async function deleteTestimonial(testimonialId: string) {
  const testimonial = await Testimonial.findById(testimonialId);
  if (!testimonial) {
    throw new AppError('Testimonial not found', 404);
  }

  if (testimonial.avatar?.publicId) {
    await deleteFromCloudinary(testimonial.avatar.publicId);
  }

  await testimonial.deleteOne();
  await invalidateHomepageCache(testimonial.storeId?.toString());
  return { success: true };
}

export async function getSiteSettings() {
  let settings = await SiteSetting.findOne({ singletonKey: 'default' });
  if (!settings) {
    settings = await SiteSetting.create({ singletonKey: 'default' });
  }
  return settings;
}

export async function updateSiteSettings(input: Record<string, any>) {
  const settings = await SiteSetting.findOneAndUpdate(
    { singletonKey: 'default' },
    { $set: input },
    {
      new: true,
      runValidators: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return settings;
}

export async function getStoreSecrets(storeId: string) {
  const store = await Store.findById(storeId).select('_id name');
  if (!store) {
    throw new AppError('Store not found', 404);
  }

  const doc = await StoreSecret.findOne({ storeId });

  return {
    storeId: store._id.toString(),
    storeName: store.name,
    secrets: maskEncryptedSecrets(doc?.secrets || {}),
  };
}

export async function updateStoreSecrets(storeId: string, inputSecrets: Record<string, string | null>) {
  const store = await Store.findById(storeId).select('_id name');
  if (!store) {
    throw new AppError('Store not found', 404);
  }

  let storeSecretsDoc = await StoreSecret.findOne({ storeId });
  if (!storeSecretsDoc) {
    storeSecretsDoc = await StoreSecret.create({ storeId: toObjectId(storeId), secrets: {} });
  }

  const updatedSecrets = new Map<string, string>(
    (storeSecretsDoc.secrets instanceof Map
      ? Array.from(storeSecretsDoc.secrets.entries())
      : Object.entries(storeSecretsDoc.secrets || {})) as Array<[string, string]>,
  );

  for (const [rawKey, value] of Object.entries(inputSecrets)) {
    const key = rawKey.trim();
    if (!key) continue;

    if (value === null || value === '') {
      updatedSecrets.delete(key);
      continue;
    }

    updatedSecrets.set(key, encryptStoreSecret(value));
  }

  storeSecretsDoc.secrets = updatedSecrets;
  storeSecretsDoc.markModified('secrets');
  await storeSecretsDoc.save();

  return {
    storeId: store._id.toString(),
    storeName: store.name,
    secrets: maskEncryptedSecrets(storeSecretsDoc.secrets),
  };
}
