import mongoose from 'mongoose';
import { Order } from '../../models/Order.model.js';
import { Product } from '../../models/Product.model.js';
import { User } from '../../models/User.model.js';
import { createPaginationResponse, parsePagination } from '../../utils/pagination.js';

export async function searchAdminStoreData(storeId: string, query: string) {
  const searchTerm = query.trim();
  const productIds = await Product.find({ storeId }).select('_id');

  const [orders, products, customers] = await Promise.all([
    Order.find({
      storeId,
      orderNumber: { $regex: searchTerm, $options: 'i' },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderNumber status totalAmount createdAt'),
    Product.find({
      storeId,
      name: { $regex: searchTerm, $options: 'i' },
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('name slug images isActive'),
    User.aggregate([
      {
        $lookup: {
          from: 'orders',
          localField: '_id',
          foreignField: 'userId',
          as: 'orders',
        },
      },
      {
        $match: {
          orders: {
            $elemMatch: {
              storeId: new mongoose.Types.ObjectId(storeId),
            },
          },
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { mobile: { $regex: searchTerm, $options: 'i' } },
          ],
        },
      },
      {
        $project: {
          name: 1,
          mobile: 1,
          email: 1,
        },
      },
      { $limit: 5 },
    ]),
  ]);

  return { orders, products, customers, productIds };
}

export async function listStoreCustomers(storeId: string, query: Record<string, any>) {
  const { page, limit, skip } = parsePagination(query);
  const matchStage: Record<string, unknown> = {
    storeId: new mongoose.Types.ObjectId(storeId),
  };

  const searchTerm = typeof query.search === 'string' ? query.search.trim() : '';
  const pipeline: any[] = [
    { $match: matchStage },
    {
      $group: {
        _id: '$userId',
        orderCount: { $sum: 1 },
        lastOrderDate: { $max: '$createdAt' },
        totalSpend: { $sum: '$totalAmount' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    ...(searchTerm
      ? [
          {
            $match: {
              $or: [
                { 'user.name': { $regex: searchTerm, $options: 'i' } },
                { 'user.mobile': { $regex: searchTerm, $options: 'i' } },
              ],
            },
          },
        ]
      : []),
    { $sort: { lastOrderDate: -1 } },
  ];

  const [rows, totalRows] = await Promise.all([
    Order.aggregate([
      ...pipeline,
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          id: '$user._id',
          name: '$user.name',
          mobile: '$user.mobile',
          email: '$user.email',
          orderCount: 1,
          lastOrderDate: 1,
          totalSpend: 1,
        },
      },
    ]),
    Order.aggregate([...pipeline, { $count: 'count' }]),
  ]);

  return createPaginationResponse(rows, totalRows[0]?.count || 0, page, limit);
}
