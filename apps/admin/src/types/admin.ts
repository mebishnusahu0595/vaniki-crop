export interface Address {
  street: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface ImageAsset {
  url: string;
  publicId: string;
  isPrimary?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
  isActive: boolean;
  image?: { url: string; publicId: string };
}

export interface ProductVariant {
  id?: string;
  label: string;
  price: number;
  adminPrice?: number;
  mrp: number;
  stock: number;
  sku: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  images: ImageAsset[];
  category?: Category;
  variants: ProductVariant[];
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  metaTitle?: string;
  metaDescription?: string;
  totalSold?: number;
  averageRating?: number;
  reviewCount?: number;
  loyaltyPointEligible?: boolean;
  maxLoyaltyPoints?: number;
  storeId?: Array<{ id: string; name: string }> | string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  mobile: string;
  profileImage?: {
    url: string;
    publicId: string;
  };
  savedAddress?: Address;
  role: 'customer' | 'storeAdmin' | 'superAdmin';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export interface DealerInventoryVariant {
  id: string;
  label: string;
  price: number;
  adminPrice?: number;
  mrp: number;
  quantity: number;
}

export interface DealerInventoryProduct {
  id: string;
  name: string;
  slug: string;
  image?: string;
  variants: DealerInventoryVariant[];
}

export interface DealerProductRequest {
  id: string;
  productName: string;
  requestedQuantity: number;
  requestedPack?: string;
  garageName?: string;
  petiQuantity?: number;
  petiSize?: number;
  petiUnit?: 'Liter' | 'Kg';
  notes?: string;
  status: 'pending' | 'contacted' | 'fulfilled' | 'rejected';
  superAdminNote?: string;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  variantLabel: string;
  price: number;
  mrp: number;
  qty: number;
  image?: string;
}

export interface OrderStatusHistoryEntry {
  status: 'placed' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  note?: string;
  timestamp: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  serviceMode?: 'delivery' | 'pickup';
  status: OrderStatusHistoryEntry['status'];
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod: 'razorpay' | 'cod';
  totalAmount: number;
  couponCode?: string;
  couponDiscount: number;
  deliveryCharge: number;
  subtotal: number;
  items: OrderItem[];
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  shippingAddress?: Address & { name?: string; mobile?: string };
  userId?: {
    id?: string;
    name: string;
    mobile?: string;
    email?: string;
    savedAddress?: Address;
  };
  storeId?: {
    id?: string;
    name: string;
    address?: Address;
    phone?: string;
    email?: string;
  };
  statusHistory: OrderStatusHistoryEntry[];
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'flat';
  value: number;
  minOrderAmount: number;
  maxDiscount?: number;
  usageLimit: number;
  usedCount: number;
  expiryDate: string;
  isActive: boolean;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  productId?: { id?: string; name: string; slug?: string };
  userId?: { id?: string; name: string; email?: string; mobile?: string };
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
  image: {
    url: string;
    mobileUrl: string;
    publicId: string;
  };
  linkedProducts: Array<{ productId: Product; position: number }>;
  isActive: boolean;
  sortOrder: number;
  startDate?: string;
  endDate?: string;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  method?: string;
  status: 'pending' | 'captured' | 'failed' | 'refunded';
  createdAt: string;
}

export interface StoreSettings {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: Address;
  location: { type: 'Point'; coordinates: [number, number] };
  openHours?: Record<string, string>;
  deliveryRadius: number;
  gstNumber?: string;
  cgst?: number;
  sgst?: number;
  igst?: number;
  loyaltyPointRupeeValue?: number;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  orderCount: number;
  lastOrderDate: string;
  totalSpend: number;
}

export interface AdminSearchResults {
  orders: Array<Pick<Order, 'id' | 'orderNumber' | 'status' | 'totalAmount' | 'createdAt'>>;
  products: Array<Pick<Product, 'id' | 'name' | 'slug' | 'images' | 'isActive'>>;
  customers: Array<Pick<Customer, 'id' | 'name' | 'mobile' | 'email'>>;
}

export interface DashboardStats {
  todayRevenue: number;
  todayOrders: number;
  pendingOrders: number;
  totalProducts: number;
  totalRevenue?: number;
  totalOrders?: number;
}

export interface RevenueSeriesPoint {
  date: string;
  amount: number;
  orders: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  sold: number;
  revenue: number;
}

export interface DashboardAnalytics {
  stats: DashboardStats;
  revenueSeries: RevenueSeriesPoint[];
  recentOrders: Order[];
  topProducts: TopProduct[];
  pendingReviews: number;
  range: '7d' | '30d';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}
