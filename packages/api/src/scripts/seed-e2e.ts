import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/database.js';
import { Banner } from '../models/Banner.model.js';
import { Category } from '../models/Category.model.js';
import { Coupon } from '../models/Coupon.model.js';
import { Order } from '../models/Order.model.js';
import { Payment } from '../models/Payment.model.js';
import { Product } from '../models/Product.model.js';
import { Review } from '../models/Review.model.js';
import { SiteSetting } from '../models/SiteSetting.model.js';
import { Store } from '../models/Store.model.js';
import { StoreSecret } from '../models/StoreSecret.model.js';
import { Testimonial } from '../models/Testimonial.model.js';
import { User, type IUser, type UserRole } from '../models/User.model.js';
import { invalidateHomepageCache } from '../utils/cache.helpers.js';

const envPath = process.env.NODE_ENV === 'production' ? '../../.env.production' : '../../.env';
dotenv.config({ path: envPath });

type ObjectId = mongoose.Types.ObjectId;

type SeedUserInput = {
  name: string;
  email: string;
  mobile: string;
  password: string;
  role: UserRole;
  referralCodeBase?: string;
  referredBy?: ObjectId | null;
  selectedStore?: ObjectId;
  wishlist?: ObjectId[];
  savedAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    landmark?: string;
  };
};

const credentials = {
  superAdmin: {
    name: 'Rahul Menon',
    email: 'superadmin@vanikicrop.com',
    mobile: '9876500001',
    password: 'SuperAdmin@123',
  },
  storeAdmin: {
    name: 'Ananya Sharma',
    email: 'koramangala.admin@vanikicrop.com',
    mobile: '9876500002',
    password: 'StoreAdmin@123',
  },
};

const customerSeeds = [
  {
    name: 'Priya Nair',
    email: 'priya.nair@example.com',
    mobile: '9876500003',
    password: 'Customer@123',
    referralCodeBase: 'PRIYANR',
    savedAddress: {
      street: '16th Main Road, Block 3, Koramangala',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
      landmark: 'Near Jyoti Nivas College',
    },
  },
  {
    name: 'Rohan Dsouza',
    email: 'rohan.dsouza@example.com',
    mobile: '9876500004',
    password: 'Customer@123',
    referralCodeBase: 'ROHNDSZ',
    savedAddress: {
      street: '8th Cross Road, Ejipura',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560047',
      landmark: 'Near Kendriya Sadan',
    },
  },
];

async function generateUniqueReferralCode(base: string, ignoreUserId?: string): Promise<string> {
  const normalizedBase = base
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10) || 'VANIKI';

  let candidate = normalizedBase;
  let suffix = 0;

  while (true) {
    const existing = await User.findOne({ referralCode: candidate }).select('_id');
    if (!existing || (ignoreUserId && existing._id.toString() === ignoreUserId)) {
      return candidate;
    }

    suffix += 1;
    const suffixText = String(suffix);
    candidate = `${normalizedBase.slice(0, Math.max(4, 10 - suffixText.length))}${suffixText}`;
  }
}

async function upsertUser(input: SeedUserInput): Promise<IUser> {
  const existing = await User.findOne({ mobile: input.mobile }).select('+password');

  if (existing) {
    existing.name = input.name;
    existing.email = input.email;
    existing.password = input.password;
    existing.role = input.role;
    existing.isActive = true;
    existing.referredBy = input.referredBy ?? null;

    if (input.referralCodeBase) {
      existing.referralCode = await generateUniqueReferralCode(
        input.referralCodeBase,
        existing._id.toString(),
      );
    }

    if (input.selectedStore !== undefined) {
      existing.selectedStore = input.selectedStore;
    }

    if (input.wishlist !== undefined) {
      existing.wishlist = input.wishlist;
    }

    if (input.savedAddress !== undefined) {
      existing.savedAddress = input.savedAddress;
    }

    return existing.save();
  }

  const referralCode = input.referralCodeBase
    ? await generateUniqueReferralCode(input.referralCodeBase)
    : undefined;

  return User.create({
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    password: input.password,
    role: input.role,
    isActive: true,
    referredBy: input.referredBy ?? null,
    selectedStore: input.selectedStore,
    wishlist: input.wishlist ?? [],
    savedAddress: input.savedAddress,
    referralCode,
  });
}

async function upsertStore(adminId: ObjectId) {
  const storePayload = {
    name: 'Vaniki Crop Koramangala Agro Store',
    adminId,
    phone: '08041234567',
    email: 'koramangala.store@vanikicrop.com',
    isActive: true,
    address: {
      street: '21, 5th Cross, Koramangala 5th Block',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560095',
    },
    location: {
      type: 'Point' as const,
      coordinates: [77.6132, 12.9352] as [number, number],
    },
    openHours: {
      monday: '07:00-22:00',
      tuesday: '07:00-22:00',
      wednesday: '07:00-22:00',
      thursday: '07:00-22:00',
      friday: '07:00-22:00',
      saturday: '07:00-23:00',
      sunday: '07:00-23:00',
    },
    deliveryRadius: 12,
  };

  let store = await Store.findOne({ adminId });
  if (!store) {
    store = await Store.findOne({ email: storePayload.email });
  }

  if (!store) {
    return Store.create(storePayload);
  }

  store.name = storePayload.name;
  store.adminId = storePayload.adminId;
  store.phone = storePayload.phone;
  store.email = storePayload.email;
  store.isActive = storePayload.isActive;
  store.address = storePayload.address;
  store.location = storePayload.location;
  store.openHours = storePayload.openHours;
  store.deliveryRadius = storePayload.deliveryRadius;

  return store.save();
}

async function seedCategories() {
  const categorySpecs = [
    {
      name: 'Insecticides',
      slug: 'insecticides',
      description: 'Systemic and contact insecticides for sucking and chewing pest control.',
      sortOrder: 1,
      image: {
        url: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80',
        publicId: 'seed/category-insecticides',
      },
    },
    {
      name: 'Herbicides',
      slug: 'herbicides',
      description: 'Selective and non-selective weed control solutions for major crops.',
      sortOrder: 2,
      image: {
        url: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1200&q=80',
        publicId: 'seed/category-herbicides',
      },
    },
    {
      name: 'Fungicides',
      slug: 'fungicides',
      description: 'Preventive and curative fungicides for blight, rust, mildew, and rot.',
      sortOrder: 3,
      image: {
        url: 'https://images.unsplash.com/photo-1471194402529-8e0f5a675de6?auto=format&fit=crop&w=1200&q=80',
        publicId: 'seed/category-fungicides',
      },
    },
    {
      name: 'Bio Pesticides',
      slug: 'bio-pesticides',
      description: 'Eco-friendly crop protection products suitable for low-residue farming.',
      sortOrder: 4,
      image: {
        url: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80',
        publicId: 'seed/category-bio-pesticides',
      },
    },
  ];

  const categoryMap = new Map<string, ObjectId>();

  for (const spec of categorySpecs) {
    const slug = spec.slug;
    const category = await Category.findOneAndUpdate(
      { slug },
      {
        name: spec.name,
        slug,
        description: spec.description,
        image: spec.image,
        sortOrder: spec.sortOrder,
        isActive: true,
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    if (!category) {
      throw new Error(`Failed to upsert category: ${spec.name}`);
    }

    categoryMap.set(slug, category._id as ObjectId);
  }

  await Category.updateMany(
    { slug: { $in: ['leafy-greens', 'fruits', 'vegetables', 'dairy'] } },
    { $set: { isActive: false } },
  );

  return categoryMap;
}

async function seedProducts(categoryMap: Map<string, ObjectId>, storeId: ObjectId) {
  const productSpecs = [
    {
      name: 'Imidacloprid 17.8% SL Insecticide',
      slug: 'imidacloprid-17-8-sl-insecticide',
      categorySlug: 'insecticides',
      shortDescription: 'Systemic insecticide for sucking pests in cotton, paddy, and pulse crops.',
      description:
        'Fast-acting imidacloprid formulation with translaminar movement for effective control of aphids, jassids, and whiteflies.',
      tags: ['insecticide', 'imidacloprid', 'systemic', 'sucking-pests'],
      isFeatured: true,
      totalSold: 412,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=1200&q=80',
          publicId: 'seed/product-imidacloprid-1',
          isPrimary: true,
        },
      ],
      variants: [
        { label: '100 ml', price: 430, mrp: 490, stock: 140, sku: 'IMIDA-100ML' },
        { label: '250 ml', price: 980, mrp: 1120, stock: 92, sku: 'IMIDA-250ML' },
      ],
    },
    {
      name: 'Chlorpyrifos 20% EC',
      slug: 'chlorpyrifos-20-ec',
      categorySlug: 'insecticides',
      shortDescription: 'Contact and stomach insecticide for stem borer, termite, and soil insects.',
      description:
        'Broad-spectrum chlorpyrifos concentrate suitable for pre- and post-emergence pest pressure across cereals and horticulture.',
      tags: ['insecticide', 'chlorpyrifos', 'termite-control', 'stem-borer'],
      isFeatured: false,
      totalSold: 276,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
          publicId: 'seed/product-chlorpyrifos-1',
          isPrimary: true,
        },
      ],
      variants: [
        { label: '250 ml', price: 290, mrp: 340, stock: 130, sku: 'CHLOR-250ML' },
        { label: '500 ml', price: 540, mrp: 620, stock: 84, sku: 'CHLOR-500ML' },
      ],
    },
    {
      name: 'Mancozeb 75% WP Fungicide',
      slug: 'mancozeb-75-wp-fungicide',
      categorySlug: 'fungicides',
      shortDescription: 'Protective fungicide for blight, leaf spot, and downy mildew management.',
      description:
        'Multi-site fungicide with broad crop compatibility for preventive disease control during high humidity windows.',
      tags: ['fungicide', 'mancozeb', 'protective', 'broad-spectrum'],
      isFeatured: true,
      totalSold: 338,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1471194402529-8e0f5a675de6?auto=format&fit=crop&w=1200&q=80',
          publicId: 'seed/product-mancozeb-1',
          isPrimary: true,
        },
      ],
      variants: [
        { label: '500 g', price: 540, mrp: 640, stock: 118, sku: 'MANCOZEB-500G' },
        { label: '1 kg', price: 980, mrp: 1120, stock: 76, sku: 'MANCOZEB-1KG' },
      ],
    },
    {
      name: 'Metalaxyl + Mancozeb Fungicide',
      slug: 'metalaxyl-mancozeb-fungicide',
      categorySlug: 'fungicides',
      shortDescription: 'Systemic plus contact fungicide for damping-off and downy mildew.',
      description:
        'Dual-mode fungicidal combination for nursery and field disease management with improved residual protection.',
      tags: ['fungicide', 'metalaxyl', 'mancozeb', 'downy-mildew'],
      isFeatured: false,
      totalSold: 196,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1200&q=80',
          publicId: 'seed/product-metalaxyl-mancozeb-1',
          isPrimary: true,
        },
      ],
      variants: [
        { label: '250 g', price: 420, mrp: 500, stock: 126, sku: 'METMAN-250G' },
        { label: '500 g', price: 780, mrp: 920, stock: 80, sku: 'METMAN-500G' },
      ],
    },
    {
      name: 'Glyphosate 41% SL Herbicide',
      slug: 'glyphosate-41-sl-herbicide',
      categorySlug: 'herbicides',
      shortDescription: 'Non-selective post-emergence herbicide for broad weed control.',
      description:
        'Fast absorption formula for controlling annual and perennial weeds in bunds, orchards, and non-crop areas.',
      tags: ['herbicide', 'glyphosate', 'weed-control', 'non-selective'],
      isFeatured: true,
      totalSold: 364,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1516253593875-bd7ba052fbc5?auto=format&fit=crop&w=1200&q=80',
          publicId: 'seed/product-glyphosate-1',
          isPrimary: true,
        },
      ],
      variants: [
        { label: '500 ml', price: 760, mrp: 890, stock: 112, sku: 'GLYPHO-500ML' },
        { label: '1 L', price: 1420, mrp: 1650, stock: 74, sku: 'GLYPHO-1L' },
      ],
    },
    {
      name: 'Neem Oil 3000 PPM Bio Pesticide',
      slug: 'neem-oil-3000-ppm-bio-pesticide',
      categorySlug: 'bio-pesticides',
      shortDescription: 'Botanical pest repellent for thrips, mites, and whiteflies.',
      description:
        'Cold-pressed neem-based bio pesticide suitable for integrated pest management and low-residue spraying programs.',
      tags: ['bio-pesticide', 'neem-oil', 'ipm', 'botanical'],
      isFeatured: false,
      totalSold: 228,
      images: [
        {
          url: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80',
          publicId: 'seed/product-neem-oil-1',
          isPrimary: true,
        },
      ],
      variants: [
        { label: '500 ml', price: 360, mrp: 420, stock: 138, sku: 'NEEM-500ML' },
        { label: '1 L', price: 690, mrp: 810, stock: 96, sku: 'NEEM-1L' },
      ],
    },
  ];

  const productMap = new Map<string, mongoose.Document & { _id: ObjectId }>();

  for (const spec of productSpecs) {
    const categoryId = categoryMap.get(spec.categorySlug);
    if (!categoryId) {
      throw new Error(`Category not found while seeding product: ${spec.name}`);
    }

    const payload = {
      name: spec.name,
      slug: spec.slug,
      description: spec.description,
      shortDescription: spec.shortDescription,
      images: spec.images,
      category: categoryId,
      storeId: [storeId],
      variants: spec.variants,
      tags: spec.tags,
      isActive: true,
      isFeatured: spec.isFeatured,
      metaTitle: `${spec.name} | Vaniki Crop`,
      metaDescription: spec.shortDescription,
      totalSold: spec.totalSold,
    };

    let product = await Product.findOne({ slug: spec.slug });
    if (!product) {
      product = await Product.create(payload);
    } else {
      product.name = payload.name;
      product.description = payload.description;
      product.shortDescription = payload.shortDescription;
      product.images = payload.images;
      product.category = payload.category;
      product.storeId = payload.storeId;
      product.variants = payload.variants;
      product.tags = payload.tags;
      product.isActive = payload.isActive;
      product.isFeatured = payload.isFeatured;
      product.metaTitle = payload.metaTitle;
      product.metaDescription = payload.metaDescription;
      product.totalSold = payload.totalSold;
      await product.save();
    }

    productMap.set(spec.slug, product as mongoose.Document & { _id: ObjectId });
  }

  await Product.updateMany(
    {
      slug: {
        $in: [
          'farm-fresh-spinach',
          'residue-free-tomatoes',
          'premium-alphonso-mango',
          'a2-cow-milk',
          'farm-paneer-block',
          'green-coriander-bunch',
        ],
      },
    },
    {
      $set: {
        isActive: false,
        isFeatured: false,
      },
    },
  );

  return productMap;
}

async function seedCoupons(storeId: ObjectId, createdBy: ObjectId) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 120);

  const couponSpecs = [
    {
      code: 'CROP20',
      type: 'percent' as const,
      value: 20,
      minOrderAmount: 999,
      maxDiscount: 350,
      usageLimit: 2000,
    },
    {
      code: 'SPRAY150',
      type: 'flat' as const,
      value: 150,
      minOrderAmount: 1999,
      usageLimit: 1500,
    },
  ];

  for (const spec of couponSpecs) {
    await Coupon.findOneAndUpdate(
      { code: spec.code },
      {
        ...spec,
        expiryDate,
        isActive: true,
        applicableStores: [storeId],
        createdBy,
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  await Coupon.updateMany(
    { code: { $in: ['GREEN20', 'FRESH100'] } },
    { $set: { isActive: false } },
  );
}

async function seedBanners(storeId: ObjectId, productMap: Map<string, mongoose.Document & { _id: ObjectId }>) {
  const imidacloprid = productMap.get('imidacloprid-17-8-sl-insecticide');
  const mancozeb = productMap.get('mancozeb-75-wp-fungicide');
  const glyphosate = productMap.get('glyphosate-41-sl-herbicide');

  if (!imidacloprid || !mancozeb || !glyphosate) {
    throw new Error('Required products for banner linking are missing.');
  }

  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 30);

  const bannerSpecs = [
    {
      title: 'Protect Every Acre, Every Stage',
      subtitle: 'Systemic insecticides and fungicides tailored for high-pressure pest seasons.',
      ctaText: 'Shop Insecticides',
      ctaLink: '/products?category=insecticides',
      image: {
        url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80',
        mobileUrl:
          'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80',
        publicId: 'seed/banner-crop-protection',
      },
      linkedProducts: [
        { productId: imidacloprid._id, position: 1 },
        { productId: mancozeb._id, position: 2 },
      ],
      storeId: null,
      sortOrder: 1,
    },
    {
      title: 'Weed Control Pro Pack',
      subtitle: 'High-performance herbicide solutions for cleaner fields and stronger crop growth.',
      ctaText: 'Explore Herbicides',
      ctaLink: '/product/glyphosate-41-sl-herbicide',
      image: {
        url: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1600&q=80',
        mobileUrl:
          'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80',
        publicId: 'seed/banner-herbicide-pack',
      },
      linkedProducts: [{ productId: glyphosate._id, position: 1 }],
      storeId,
      sortOrder: 2,
    },
  ];

  for (const spec of bannerSpecs) {
    const filter = { title: spec.title, storeId: spec.storeId ?? null };
    let banner = await Banner.findOne(filter);

    if (!banner) {
      banner = await Banner.create({
        ...spec,
        isActive: true,
        startDate: now,
        endDate: nextMonth,
      });
      continue;
    }

    banner.subtitle = spec.subtitle;
    banner.ctaText = spec.ctaText;
    banner.ctaLink = spec.ctaLink;
    banner.image = spec.image;
    banner.linkedProducts = spec.linkedProducts;
    banner.storeId = spec.storeId;
    banner.sortOrder = spec.sortOrder;
    banner.isActive = true;
    banner.startDate = now;
    banner.endDate = nextMonth;

    await banner.save();
  }

  await Banner.updateMany(
    { title: { $in: ['Daily Fresh Essentials', 'Mango Festival Offer'] } },
    { $set: { isActive: false } },
  );
}

async function seedTestimonials(storeId: ObjectId) {
  const testimonials = [
    {
      name: 'Meera Iyer',
      designation: 'Progressive Farmer, Ramanagara',
      message:
        'Authentic products and clear dosage guidance helped us recover from early pest pressure in chilli this season.',
      rating: 5,
      storeId: null,
      sortOrder: 1,
      avatar: {
        url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80',
        publicId: 'seed/testimonial-meera',
      },
    },
    {
      name: 'Arvind Rao',
      designation: 'Agri Input Retailer, Bengaluru',
      message:
        'Vaniki Crop keeps moving inventory and variant packs in sync. It is easier to serve farmers with urgent requirements.',
      rating: 5,
      storeId,
      sortOrder: 2,
      avatar: {
        url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=80',
        publicId: 'seed/testimonial-arvind',
      },
    },
    {
      name: 'Nisha George',
      designation: 'Paddy Grower, Mandya',
      message:
        'I switched to the recommended fungicide combo and saw cleaner foliage within a week. Repeat ordering is very smooth.',
      rating: 4,
      storeId: null,
      sortOrder: 3,
      avatar: {
        url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=500&q=80',
        publicId: 'seed/testimonial-nisha',
      },
    },
  ];

  for (const spec of testimonials) {
    const filter = { name: spec.name, storeId: spec.storeId ?? null };
    const existing = await Testimonial.findOne(filter);

    if (!existing) {
      await Testimonial.create({ ...spec, isActive: true });
      continue;
    }

    existing.designation = spec.designation;
    existing.message = spec.message;
    existing.rating = spec.rating;
    existing.storeId = spec.storeId;
    existing.sortOrder = spec.sortOrder;
    existing.avatar = spec.avatar;
    existing.isActive = true;
    await existing.save();
  }

  const activeNames = testimonials.map((entry) => entry.name);
  await Testimonial.updateMany(
    {
      name: { $nin: activeNames },
      $or: [{ storeId: null }, { storeId }],
    },
    { $set: { isActive: false } },
  );
}

async function upsertOrderAndPayment(params: {
  orderNumber: string;
  customerId: ObjectId;
  storeId: ObjectId;
  items: Array<{
    productId: ObjectId;
    variantId: ObjectId;
    productName: string;
    variantLabel: string;
    price: number;
    mrp: number;
    qty: number;
    image?: string;
  }>;
  couponCode?: string;
  couponDiscount?: number;
  deliveryCharge: number;
  status: 'placed' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod: 'razorpay' | 'cod';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  shippingAddress: {
    name: string;
    mobile: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  statusHistory: Array<{ status: string; note: string; timestamp: Date }>;
  razorpay?: {
    orderId: string;
    paymentId: string;
    signature: string;
  };
}) {
  const subtotal = params.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const couponDiscount = params.couponDiscount ?? 0;
  const totalAmount = subtotal - couponDiscount + params.deliveryCharge;

  let order = await Order.findOne({ orderNumber: params.orderNumber });

  const payload = {
    orderNumber: params.orderNumber,
    userId: params.customerId,
    storeId: params.storeId,
    serviceMode: 'delivery' as const,
    items: params.items,
    subtotal,
    discount: 0,
    couponCode: params.couponCode,
    couponDiscount,
    deliveryCharge: params.deliveryCharge,
    totalAmount,
    shippingAddress: params.shippingAddress,
    paymentStatus: params.paymentStatus,
    paymentMethod: params.paymentMethod,
    razorpayOrderId: params.razorpay?.orderId,
    razorpayPaymentId: params.razorpay?.paymentId,
    razorpaySignature: params.razorpay?.signature,
    status: params.status,
    statusHistory: params.statusHistory,
    adminNote: 'Seeded order for E2E workflow validation',
  };

  if (!order) {
    order = await Order.create(payload);
  } else {
    order.userId = payload.userId;
    order.storeId = payload.storeId;
    order.serviceMode = payload.serviceMode;
    order.items = payload.items;
    order.subtotal = payload.subtotal;
    order.discount = payload.discount;
    order.couponCode = payload.couponCode;
    order.couponDiscount = payload.couponDiscount;
    order.deliveryCharge = payload.deliveryCharge;
    order.totalAmount = payload.totalAmount;
    order.shippingAddress = payload.shippingAddress;
    order.paymentStatus = payload.paymentStatus;
    order.paymentMethod = payload.paymentMethod;
    order.razorpayOrderId = payload.razorpayOrderId;
    order.razorpayPaymentId = payload.razorpayPaymentId;
    order.razorpaySignature = payload.razorpaySignature;
    order.status = payload.status;
    order.statusHistory = payload.statusHistory;
    order.adminNote = payload.adminNote;
    await order.save();
  }

  await Payment.findOneAndUpdate(
    { orderId: order._id },
    {
      orderId: order._id,
      userId: params.customerId,
      storeId: params.storeId,
      amount: totalAmount,
      currency: 'INR',
      razorpayOrderId: params.razorpay?.orderId,
      razorpayPaymentId: params.razorpay?.paymentId,
      razorpaySignature: params.razorpay?.signature,
      method: params.paymentMethod === 'cod' ? 'cash' : 'upi',
      status:
        params.paymentStatus === 'paid'
          ? 'captured'
          : params.paymentStatus === 'failed'
            ? 'failed'
            : params.paymentStatus === 'refunded'
              ? 'refunded'
              : 'pending',
      webhookPayload: {
        source: 'seed-script',
        orderNumber: params.orderNumber,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

async function seedReviews(params: {
  superAdminId: ObjectId;
  productMap: Map<string, mongoose.Document & { _id: ObjectId }>;
  customerA: ObjectId;
  customerB: ObjectId;
}) {
  const imidacloprid = params.productMap.get('imidacloprid-17-8-sl-insecticide');
  const mancozeb = params.productMap.get('mancozeb-75-wp-fungicide');
  const glyphosate = params.productMap.get('glyphosate-41-sl-herbicide');

  if (!imidacloprid || !mancozeb || !glyphosate) {
    throw new Error('Required products for review seeding are missing.');
  }

  const reviewSpecs = [
    {
      productId: imidacloprid._id,
      userId: params.customerA,
      rating: 5,
      comment: 'Excellent knockdown on whitefly in cotton. Visible reduction within two spray cycles.',
      isApproved: true,
      approvedBy: params.superAdminId,
    },
    {
      productId: mancozeb._id,
      userId: params.customerB,
      rating: 4,
      comment: 'Worked well as a preventive spray for leaf spot in chilli. Coverage and consistency are good.',
      isApproved: true,
      approvedBy: params.superAdminId,
    },
    {
      productId: glyphosate._id,
      userId: params.customerA,
      rating: 5,
      comment: 'Reliable weed burn-down in non-crop bunds and channels. Delivery and packaging were on point.',
      isApproved: true,
      approvedBy: params.superAdminId,
    },
  ];

  for (const spec of reviewSpecs) {
    let review = await Review.findOne({ productId: spec.productId, userId: spec.userId });

    if (!review) {
      review = await Review.create({
        ...spec,
        approvedAt: new Date(),
      });
      continue;
    }

    review.rating = spec.rating;
    review.comment = spec.comment;
    review.isApproved = spec.isApproved;
    review.approvedBy = spec.approvedBy;
    review.approvedAt = new Date();
    await review.save();
  }
}

async function seedSiteSettings() {
  await SiteSetting.findOneAndUpdate(
    { singletonKey: 'default' },
    {
      singletonKey: 'default',
      platformName: 'Vaniki Crop',
      supportEmail: 'teams@vanikicrop.com',
      supportPhone: '+91-8041234567',
      maintenanceMode: false,
      homepageHeadline: 'Trusted crop protection products delivered fast to your farm cluster.',
      defaultDeliveryRadius: 12,
      allowGuestCheckout: false,
      metaTitle: 'Vaniki Crop | Pesticides, Herbicides and Fungicides Online',
      metaDescription:
        'Buy genuine insecticides, fungicides, herbicides and bio-pesticides with fast delivery, pickup support, and agronomy-ready stock.',
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

async function seedStoreSecrets(storeId: ObjectId) {
  await StoreSecret.findOneAndUpdate(
    { storeId },
    {
      storeId,
      secrets: {
        RAZORPAY_KEY_ID: 'rzp_live_store_seed_key',
        RAZORPAY_KEY_SECRET: 'rzp_live_store_seed_secret',
        SMS_AUTH_KEY: 'msg91_store_auth_key',
        SMTP_PASSWORD: 'smtp_store_seed_password',
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

async function main() {
  console.log('Seeding realistic E2E data for Vaniki Crop...');

  await connectDB();

  const superAdmin = await upsertUser({
    ...credentials.superAdmin,
    role: 'superAdmin',
    referralCodeBase: 'SUPADMIN',
  });

  const storeAdmin = await upsertUser({
    ...credentials.storeAdmin,
    role: 'storeAdmin',
    referralCodeBase: 'STOREADM',
  });

  const store = await upsertStore(storeAdmin._id as ObjectId);

  const customerA = await upsertUser({
    ...customerSeeds[0],
    role: 'customer',
    selectedStore: store._id as ObjectId,
  });

  const customerB = await upsertUser({
    ...customerSeeds[1],
    role: 'customer',
    referredBy: customerA._id as ObjectId,
    selectedStore: store._id as ObjectId,
  });

  const referralCount = await User.countDocuments({ referredBy: customerA._id });
  customerA.referralCount = referralCount;
  await customerA.save();

  const categoryMap = await seedCategories();
  const productMap = await seedProducts(categoryMap, store._id as ObjectId);

  const wishlistProducts = [
    productMap.get('imidacloprid-17-8-sl-insecticide')?._id,
    productMap.get('mancozeb-75-wp-fungicide')?._id,
  ].filter(Boolean) as ObjectId[];

  customerA.wishlist = wishlistProducts;
  await customerA.save();

  const imidaclopridVariant = productMap.get('imidacloprid-17-8-sl-insecticide')?.get('variants')?.[0];
  const mancozebVariant = productMap.get('mancozeb-75-wp-fungicide')?.get('variants')?.[0];
  const glyphosateVariant = productMap.get('glyphosate-41-sl-herbicide')?.get('variants')?.[0];

  const imidacloprid = productMap.get('imidacloprid-17-8-sl-insecticide');
  const mancozeb = productMap.get('mancozeb-75-wp-fungicide');
  const glyphosate = productMap.get('glyphosate-41-sl-herbicide');

  if (!imidacloprid || !mancozeb || !glyphosate || !imidaclopridVariant || !mancozebVariant || !glyphosateVariant) {
    throw new Error('Required products/variants for order seeding are missing.');
  }

  await upsertOrderAndPayment({
    orderNumber: 'VNK-E2E-0001',
    customerId: customerA._id as ObjectId,
    storeId: store._id as ObjectId,
    items: [
      {
        productId: imidacloprid._id,
        variantId: imidaclopridVariant._id as ObjectId,
        productName: imidacloprid.get('name') as string,
        variantLabel: imidaclopridVariant.label,
        price: imidaclopridVariant.price,
        mrp: imidaclopridVariant.mrp,
        qty: 2,
        image: imidacloprid.get('images')?.[0]?.url as string | undefined,
      },
      {
        productId: mancozeb._id,
        variantId: mancozebVariant._id as ObjectId,
        productName: mancozeb.get('name') as string,
        variantLabel: mancozebVariant.label,
        price: mancozebVariant.price,
        mrp: mancozebVariant.mrp,
        qty: 1,
        image: mancozeb.get('images')?.[0]?.url as string | undefined,
      },
    ],
    couponCode: 'CROP20',
    couponDiscount: 120,
    deliveryCharge: 20,
    status: 'delivered',
    paymentMethod: 'razorpay',
    paymentStatus: 'paid',
    shippingAddress: {
      name: customerSeeds[0].name,
      mobile: customerSeeds[0].mobile,
      street: customerSeeds[0].savedAddress.street,
      city: customerSeeds[0].savedAddress.city,
      state: customerSeeds[0].savedAddress.state,
      pincode: customerSeeds[0].savedAddress.pincode,
    },
    statusHistory: [
      { status: 'placed', note: 'Order placed by customer', timestamp: new Date(Date.now() - 2 * 86400000) },
      { status: 'confirmed', note: 'Order confirmed by store', timestamp: new Date(Date.now() - 2 * 86400000 + 3600000) },
      { status: 'processing', note: 'Packed and ready to dispatch', timestamp: new Date(Date.now() - 2 * 86400000 + 7200000) },
      { status: 'shipped', note: 'Out for delivery', timestamp: new Date(Date.now() - 2 * 86400000 + 14400000) },
      { status: 'delivered', note: 'Delivered successfully', timestamp: new Date(Date.now() - 2 * 86400000 + 21600000) },
    ],
    razorpay: {
      orderId: 'order_E2E_VNK_0001',
      paymentId: 'pay_E2E_VNK_0001',
      signature: 'seed_signature_0001',
    },
  });

  await upsertOrderAndPayment({
    orderNumber: 'VNK-E2E-0002',
    customerId: customerB._id as ObjectId,
    storeId: store._id as ObjectId,
    items: [
      {
        productId: glyphosate._id,
        variantId: glyphosateVariant._id as ObjectId,
        productName: glyphosate.get('name') as string,
        variantLabel: glyphosateVariant.label,
        price: glyphosateVariant.price,
        mrp: glyphosateVariant.mrp,
        qty: 3,
        image: glyphosate.get('images')?.[0]?.url as string | undefined,
      },
    ],
    couponCode: 'SPRAY150',
    couponDiscount: 150,
    deliveryCharge: 20,
    status: 'processing',
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    shippingAddress: {
      name: customerSeeds[1].name,
      mobile: customerSeeds[1].mobile,
      street: customerSeeds[1].savedAddress.street,
      city: customerSeeds[1].savedAddress.city,
      state: customerSeeds[1].savedAddress.state,
      pincode: customerSeeds[1].savedAddress.pincode,
    },
    statusHistory: [
      { status: 'placed', note: 'Order placed by customer', timestamp: new Date(Date.now() - 36000000) },
      { status: 'confirmed', note: 'Order confirmed by store', timestamp: new Date(Date.now() - 32400000) },
      { status: 'processing', note: 'Preparing order for dispatch', timestamp: new Date(Date.now() - 28800000) },
    ],
  });

  await seedReviews({
    superAdminId: superAdmin._id as ObjectId,
    productMap,
    customerA: customerA._id as ObjectId,
    customerB: customerB._id as ObjectId,
  });

  await seedCoupons(store._id as ObjectId, superAdmin._id as ObjectId);
  await seedBanners(store._id as ObjectId, productMap);
  await seedTestimonials(store._id as ObjectId);
  await seedSiteSettings();
  await seedStoreSecrets(store._id as ObjectId);
  await invalidateHomepageCache((store._id as ObjectId).toString());

  console.log('');
  console.log('Seed completed successfully.');
  console.log('');
  console.log('Super Admin Credentials');
  console.log(`  mobile   : ${credentials.superAdmin.mobile}`);
  console.log(`  password : ${credentials.superAdmin.password}`);
  console.log('');
  console.log('Store Admin Credentials');
  console.log(`  mobile   : ${credentials.storeAdmin.mobile}`);
  console.log(`  password : ${credentials.storeAdmin.password}`);
  console.log('');
  console.log('Seeded Store');
  console.log(`  name     : ${store.name}`);
  console.log(`  id       : ${store._id.toString()}`);
  console.log('');
  console.log('Customer Accounts');
  console.log(`  ${customerSeeds[0].name} (${customerSeeds[0].mobile})`);
  console.log(`  ${customerSeeds[1].name} (${customerSeeds[1].mobile})`);
  console.log(`  customer password : ${customerSeeds[0].password}`);
  console.log('');
}

main()
  .then(async () => {
    await disconnectDB();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    try {
      await disconnectDB();
    } catch {
      // ignore disconnect errors on failure path
    }
    process.exit(1);
  });
