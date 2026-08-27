import mongoose from 'mongoose';
import { Order } from '../../models/Order.model.js';
import { Product } from '../../models/Product.model.js';
import { Review } from '../../models/Review.model.js';
import { PageView } from '../../models/PageView.model.js';
import { Visitor } from '../../models/Visitor.model.js';
import { redisConnection } from '../../config/redis.js';

const ANALYTICS_CACHE_TTL = 300; // 5 minutes in seconds

/**
 * Super Admin Analytics (Global Dashboard)
 */
export async function getSuperAdminAnalytics() {
  const cacheKey = 'analytics:superadmin:global';
  const cachedData = await redisConnection.get(cacheKey);
  if (cachedData) return JSON.parse(cachedData);

  // 1. Basic Stats (Revenue, Orders)
  const stats = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalOrders: { $count: {} },
      },
    },
  ]);

  const { totalRevenue = 0, totalOrders = 0 } = stats[0] || {};

  // 2. Revenue by Store
  const byStore = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    {
      $group: {
        _id: '$storeId',
        revenue: { $sum: '$totalAmount' },
        orders: { $count: {} },
      },
    },
    {
      $lookup: {
        from: 'stores',
        localField: '_id',
        foreignField: '_id',
        as: 'storeInfo',
      },
    },
    { $unwind: '$storeInfo' },
    {
      $project: {
        storeId: '$_id',
        storeName: '$storeInfo.name',
        revenue: 1,
        orders: 1,
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  // 3. Revenue Timeline (Last 30 Days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const revenueTimeline = await Order.aggregate([
    { $match: { paymentStatus: 'paid', createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        amount: { $sum: '$totalAmount' },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', amount: 1, _id: 0 } },
  ]);

  // 4. Top Sold Products (Global)
  const topProducts = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$items.productName' },
        sold: { $sum: '$items.qty' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
      },
    },
    { $sort: { sold: -1 } },
    { $limit: 10 },
    { $project: { productId: '$_id', name: 1, sold: 1, revenue: 1, _id: 0 } },
  ]);

  // 5. Recent Orders
  const recentOrders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('userId', 'name')
    .populate('storeId', 'name');

  // 6. Pending Reviews count
  const pendingReviews = await Review.countDocuments({ status: 'pending' });

  const result = {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOrders,
    byStore,
    revenueTimeline,
    topProducts,
    recentOrders,
    pendingReviews,
  };

  // Cache for 5 mins
  await redisConnection.setex(cacheKey, ANALYTICS_CACHE_TTL, JSON.stringify(result));

  return result;
}

/**
 * Store Admin Analytics (Store-level Dashboard)
 * @param storeId - ID of the store to fetch analytics for
 */
export async function getStoreAdminAnalytics(storeId: string, query: Record<string, any> = {}) {
  const range = query.range === '7d' ? '7d' : '30d';
  const cacheKey = `analytics:admin:${storeId}:${range}`;
  const cachedData = await redisConnection.get(cacheKey);
  if (cachedData) return JSON.parse(cachedData);

  const sId = new mongoose.Types.ObjectId(storeId);
  const days = range === '7d' ? 7 : 30;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // 1. Overall Stats
  const stats = await Order.aggregate([
    { $match: { storeId: sId, paymentStatus: 'paid' } },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalOrders: { $count: {} },
      },
    },
  ]);

  const { totalRevenue = 0, totalOrders = 0 } = stats[0] || {};
  const [todayRevenueAgg, todayOrders, pendingOrders, totalProducts, recentOrders, pendingReviews, topProducts] =
    await Promise.all([
      Order.aggregate([
        {
          $match: {
            storeId: sId,
            paymentStatus: 'paid',
            createdAt: { $gte: todayStart, $lt: todayEnd },
          },
        },
        { $group: { _id: null, amount: { $sum: '$totalAmount' } } },
      ]),
      Order.countDocuments({ storeId: sId, createdAt: { $gte: todayStart, $lt: todayEnd } }),
      Order.countDocuments({ storeId: sId, status: { $in: ['placed', 'confirmed', 'processing'] } }),
      Product.countDocuments({ storeId: sId }),
      Order.find({ storeId: sId })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'name mobile email')
        .select('orderNumber createdAt totalAmount status paymentStatus paymentMethod items userId'),
      (async () => {
        const productIds = await Product.find({ storeId: sId }).distinct('_id');
        return Review.countDocuments({ productId: { $in: productIds }, isApproved: false });
      })(),
      Order.aggregate([
        { $match: { storeId: sId, paymentStatus: 'paid' } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.productName' },
            sold: { $sum: '$items.qty' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
          },
        },
        { $sort: { sold: -1 } },
        { $limit: 10 },
        { $project: { productId: '$_id', name: 1, sold: 1, revenue: 1, _id: 0 } },
      ]),
    ]);

  // 2. Revenue Timeline
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const revenueTimeline = await Order.aggregate([
    { $match: { storeId: sId, paymentStatus: 'paid', createdAt: { $gte: sinceDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        amount: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', amount: 1, orders: 1, _id: 0 } },
  ]);

  const result = {
    stats: {
      todayRevenue: Math.round(((todayRevenueAgg[0]?.amount || 0) as number) * 100) / 100,
      todayOrders,
      pendingOrders,
      totalProducts,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
    },
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOrders,
    revenueSeries: revenueTimeline,
    revenueTimeline,
    topProducts,
    recentOrders,
    pendingReviews,
    range,
  };

  // Cache for 5 mins
  await redisConnection.setex(cacheKey, ANALYTICS_CACHE_TTL, JSON.stringify(result));

  return result;
}

/**
 * Record a new page view log, dynamically resolving product detail page views
 */
export async function recordPageView(payload: {
  url: string;
  visitorId: string;
  userAgent?: string;
  device: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  ip?: string;
}) {
  const { url, visitorId, userAgent, device, ip } = payload;

  let productId: string | null = null;

  // Resolve product ID automatically if it's a product page URL (e.g. /product/super-grow)
  if (url.startsWith('/product/')) {
    const parts = url.split('/');
    const slugWithParams = parts[2] || '';
    const slug = slugWithParams.split('?')[0].split('#')[0]; // strip query or hash
    if (slug) {
      const product = await Product.findOne({ slug }).select('_id');
      if (product) {
        productId = product._id.toString();
      }
    }
  }

  const pageView = new PageView({
    url,
    visitorId,
    productId,
    userAgent,
    device,
    ip,
  });

  await pageView.save();
  return pageView;
}

/**
 * Super Admin Global Website Traffic & Visitor Analytics
 */
export async function getWebsiteReporting() {
  const cacheKey = 'analytics:superadmin:website-reporting';
  const cachedData = await redisConnection.get(cacheKey);
  if (cachedData) return JSON.parse(cachedData);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOf30DaysAgo = new Date(startOfToday);
  startOf30DaysAgo.setDate(startOf30DaysAgo.getDate() - 30);

  // 1. General Traffic Stats Overview
  const [totalViews, uniqueVisitors, totalProductViews, viewsToday] = await Promise.all([
    PageView.countDocuments(),
    PageView.distinct('visitorId').then((arr) => arr.length),
    PageView.countDocuments({ productId: { $ne: null } }),
    PageView.countDocuments({ createdAt: { $gte: startOfToday } }),
  ]);

  // 2. Timeline Daily View Counter (last 30 days)
  const timelineAgg = await PageView.aggregate([
    { $match: { createdAt: { $gte: startOf30DaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        views: { $sum: 1 },
        visitors: { $addToSet: '$visitorId' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const timelinePoints = timelineAgg.map((point) => ({
    date: point._id,
    views: point.views,
    visitors: point.visitors.length,
  }));

  // 3. Top Pages (most visited URLs)
  const topPagesAgg = await PageView.aggregate([
    {
      $group: {
        _id: '$url',
        views: { $sum: 1 },
        visitors: { $addToSet: '$visitorId' },
      },
    },
    { $sort: { views: -1 } },
    { $limit: 15 },
  ]);

  const topPages = topPagesAgg.map((page) => ({
    url: page._id,
    views: page.views,
    visitors: page.visitors.length,
  }));

  // 4. Top Viewed Products (aggregate product view counts and lookup detail)
  const topProductsAgg = await PageView.aggregate([
    { $match: { productId: { $ne: null } } },
    {
      $group: {
        _id: '$productId',
        views: { $sum: 1 },
        visitors: { $addToSet: '$visitorId' },
      },
    },
    { $sort: { views: -1 } },
    { $limit: 10 },
  ]);

  const productIds = topProductsAgg.map((p) => p._id);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('name images slug shortDescription')
    .lean();

  const topViewedProducts = topProductsAgg
    .map((item) => {
      const product = products.find((p) => p._id.toString() === item._id.toString());
      if (!product) return null;
      return {
        id: product._id.toString(),
        name: product.name,
        image: product.images?.[0]?.url || '',
        slug: product.slug,
        shortDescription: product.shortDescription || '',
        views: item.views,
        visitors: item.visitors.length,
      };
    })
    .filter(Boolean);

  const report = {
    stats: {
      totalViews,
      uniqueVisitors,
      totalProductViews,
      viewsToday,
    },
    timeline: timelinePoints,
    topPages,
    topViewedProducts,
  };

  // Cache website analytics for 3 minutes
  await redisConnection.setex(cacheKey, 180, JSON.stringify(report));

  return report;
}

/**
 * Record live visitor telemetry (IP, GPS Coordinates, Location, Device)
 */
export async function recordTelemetry(data: {
  visitorId: string;
  userId?: string;
  userName?: string;
  userMobile?: string;
  coordinates?: { latitude: number; longitude: number; accuracy?: number };
  location?: { city?: string; district?: string; state?: string; pincode?: string; country?: string; formattedAddress?: string };
  device?: { platform?: string; os?: string; browser?: string; appVariant?: string; userAgent?: string };
  url?: string;
  ip?: string;
}) {
  const { visitorId, userId, userName, userMobile, coordinates, location, device, url, ip } = data;
  if (!visitorId) return null;

  const updateDoc: any = {
    $set: {
      lastSeen: new Date(),
      ip: ip || 'Unknown',
    },
    $inc: { visitCount: 1 },
    $setOnInsert: {
      firstSeen: new Date(),
    },
  };

  if (userId) updateDoc.$set.userId = userId;
  if (userName) updateDoc.$set.userName = userName;
  if (userMobile) {
    updateDoc.$set.userMobile = userMobile;
    updateDoc.$set.isRegistered = true;
  }
  if (coordinates && typeof coordinates.latitude === 'number' && typeof coordinates.longitude === 'number') {
    updateDoc.$set.coordinates = coordinates;
  }
  if (location && (location.city || location.state || location.pincode || location.formattedAddress)) {
    updateDoc.$set.location = location;
  }
  if (device) {
    updateDoc.$set.device = device;
  }
  if (url) {
    updateDoc.$push = {
      recentPages: {
        $each: [url],
        $slice: -15,
      },
    };
  }

  const visitor = await Visitor.findOneAndUpdate(
    { visitorId },
    updateDoc,
    { upsert: true, new: true }
  );

  return visitor;
}

/**
 * List visitors with coordinates and IP for SuperAdmin
 */
export async function listVisitors(query: Record<string, any>) {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  const skip = (page - 1) * limit;

  const filter: Record<string, any> = {};

  if (query.search && typeof query.search === 'string' && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { visitorId: searchRegex },
      { ip: searchRegex },
      { userName: searchRegex },
      { userMobile: searchRegex },
      { 'location.city': searchRegex },
      { 'location.state': searchRegex },
      { 'location.pincode': searchRegex },
      { 'device.platform': searchRegex },
      { 'device.os': searchRegex },
    ];
  }

  if (query.isRegistered === 'registered') {
    filter.isRegistered = true;
  } else if (query.isRegistered === 'visitor') {
    filter.isRegistered = false;
  }

  if (query.hasCoordinates === 'true' || query.hasCoordinates === true) {
    filter['coordinates.latitude'] = { $exists: true, $ne: null };
  }

  const [visitors, total] = await Promise.all([
    Visitor.find(filter)
      .sort({ lastSeen: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Visitor.countDocuments(filter),
  ]);

  const mapped = visitors.map((v: any) => ({
    id: v._id?.toString() || v.visitorId,
    visitorId: v.visitorId,
    userId: v.userId,
    userName: v.userName,
    userMobile: v.userMobile,
    isRegistered: Boolean(v.isRegistered),
    ip: v.ip || 'Unknown IP',
    coordinates: v.coordinates || null,
    mapsUrl: v.coordinates?.latitude && v.coordinates?.longitude
      ? `https://www.google.com/maps?q=${v.coordinates.latitude},${v.coordinates.longitude}`
      : null,
    location: v.location || null,
    device: v.device || null,
    firstSeen: v.firstSeen || v.createdAt,
    lastSeen: v.lastSeen || v.updatedAt,
    visitCount: v.visitCount || 1,
    recentPages: v.recentPages || [],
  }));

  return {
    data: mapped,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
