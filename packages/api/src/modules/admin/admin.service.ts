import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { DealerInventory } from '../../models/DealerInventory.model.js';
import { Order } from '../../models/Order.model.js';
import { Product } from '../../models/Product.model.js';
import { ProductRequest } from '../../models/ProductRequest.model.js';
import { SiteSetting } from '../../models/SiteSetting.model.js';
import { User } from '../../models/User.model.js';
import { createPaginationResponse, parsePagination } from '../../utils/pagination.js';

export async function searchAdminStoreData(storeId: string, query: string) {
  const searchTerm = query.trim();
  const inventoryProductIds = await DealerInventory.find({ storeId })
    .distinct('productId');

  const [orders, products, customers] = await Promise.all([
    Order.find({
      storeId,
      orderNumber: { $regex: searchTerm, $options: 'i' },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderNumber status totalAmount createdAt'),
    Product.find({
      _id: { $in: inventoryProductIds },
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

  return { orders, products, customers };
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

export async function listDealerInventory(storeId: string) {
  const products = await Product.find({ isActive: true })
    .select('name slug images category variants isActive shortDescription petiSize petiUnit')
    .populate('category', 'name')
    .sort({ updatedAt: -1 });

  const productIds = products.map((product) => product._id as mongoose.Types.ObjectId);
  const inventoryRows = productIds.length
    ? await DealerInventory.find({ storeId, productId: { $in: productIds } }).select('productId variantId quantity')
    : [];

  const quantityByVariant = new Map<string, number>();
  for (const row of inventoryRows) {
    quantityByVariant.set(`${row.productId.toString()}:${row.variantId.toString()}`, row.quantity);
  }

  return products.map((product) => ({
    id: (product._id as mongoose.Types.ObjectId).toString(),
    name: product.name,
    slug: product.slug,
    image: product.images?.[0]?.url,
    category: product.category,
    shortDescription: product.shortDescription,
    petiSize: product.petiSize,
    petiUnit: product.petiUnit,
    variants: product.variants.map((variant: any) => {
      const variantId = variant._id.toString();
      const key = `${(product._id as mongoose.Types.ObjectId).toString()}:${variantId}`;
      return {
        id: variantId,
        label: variant.label,
        price: variant.price,
        mrp: variant.mrp,
        quantity: quantityByVariant.get(key) ?? 0,
      };
    }),
  }));
}

export async function upsertDealerInventory(
  storeId: string,
  adminId: string,
  entries: Array<{ productId: string; variantId: string; quantity: number }>,
) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new AppError('At least one inventory row is required', 400);
  }

  const productIds = Array.from(new Set(entries.map((entry) => entry.productId)));
  const products = await Product.find({ _id: { $in: productIds } }).select('variants');
  const productById = new Map<string, any>(
    products.map((product) => [(product._id as mongoose.Types.ObjectId).toString(), product]),
  );

  for (const entry of entries) {
    const product = productById.get(entry.productId);
    if (!product) {
      throw new AppError('Invalid product in inventory payload', 400);
    }

    const hasVariant = product.variants.some((variant: any) => variant._id.toString() === entry.variantId);
    if (!hasVariant) {
      throw new AppError('Invalid product variant in inventory payload', 400);
    }

    const safeQuantity = Number.isFinite(Number(entry.quantity)) ? Math.max(0, Number(entry.quantity)) : 0;

    const existingInventoryRow = await DealerInventory.findOne({
      storeId,
      productId: entry.productId,
      variantId: entry.variantId,
    }).select('quantity');

    if (existingInventoryRow && safeQuantity < existingInventoryRow.quantity) {
      throw new AppError('Quantity can only be increased by store admins. Decreases happen through order deductions.', 400);
    }

    await DealerInventory.findOneAndUpdate(
      {
        storeId,
        productId: entry.productId,
        variantId: entry.variantId,
      },
      {
        quantity: safeQuantity,
        updatedBy: adminId,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  return listDealerInventory(storeId);
}

export async function createDealerProductRequest(
  storeId: string,
  adminId: string,
  input: any,
) {
  const items = Array.isArray(input.items) ? input.items : [input];
  const results = [];

  for (const item of items) {
    const requestedQuantity = Number(item.requestedQuantity || item.quantity || 0);
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      throw new AppError('Requested quantity must be greater than 0', 400);
    }

    const requestedPack = typeof item.requestedPack === 'string'
      ? item.requestedPack.trim()
      : typeof item.packSize === 'string'
        ? item.packSize.trim()
        : undefined;

    const notes = typeof item.notes === 'string' ? item.notes.trim() : undefined;

    let productId: mongoose.Types.ObjectId | undefined;
    let productName = typeof item.productName === 'string' ? item.productName.trim() : '';
    let petiSize = 12;
    let petiUnit = 'Liter';

    if (typeof item.productId === 'string' && mongoose.Types.ObjectId.isValid(item.productId)) {
      const product = await Product.findById(item.productId).select('name petiSize petiUnit shortDescription');
      if (!product) {
        throw new AppError('Selected product not found', 404);
      }
      productId = product._id as mongoose.Types.ObjectId;
      if (!productName) {
        productName = product.shortDescription || product.name;
      }
      if (product.petiSize) petiSize = product.petiSize;
      if (product.petiUnit) petiUnit = product.petiUnit;
    }

    if (!productName) {
      throw new AppError('Product name is required for request', 400);
    }

    const request = await ProductRequest.create({
      storeId,
      adminId,
      productId,
      productName,
      requestedQuantity,
      requestedPack,
      garageName: typeof item.garageName === 'string' ? item.garageName.trim() : input.garageName || 'Unknown Garage',
      petiQuantity: Number(item.petiQuantity) || 1,
      petiSize: petiSize,
      petiUnit: petiUnit,
      notes: notes || input.notes,
      status: 'pending',
    });

    results.push(request);
  }

  return results;
}

export async function listDealerProductRequests(storeId: string, query: Record<string, any>) {
  const { page, limit, skip } = parsePagination(query);
  const filter: Record<string, any> = { storeId };

  if (query.status && ['pending', 'contacted', 'fulfilled', 'rejected'].includes(String(query.status))) {
    filter.status = String(query.status);
  }

  const [rows, total] = await Promise.all([
    ProductRequest.find(filter)
      .populate('productId', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ProductRequest.countDocuments(filter),
  ]);

  return createPaginationResponse(rows, total, page, limit);
}

export async function getGarages(): Promise<string[]> {
  const settings = await SiteSetting.findOne({ singletonKey: 'default' }).select('garageNames');
  return settings?.garageNames || [];
}
