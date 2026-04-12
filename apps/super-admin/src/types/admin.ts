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
  storeId?: Array<{ id: string; name: string }> | string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  mobile: string;
  role: 'customer' | 'storeAdmin' | 'superAdmin';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
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
  applicableStores?: Array<{ id: string; name: string }>;
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
  storeId?: string | { id: string; name: string } | null;
  isActive: boolean;
  sortOrder: number;
  startDate?: string;
  endDate?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  orderNumber: string;
  store: {
    id?: string;
    name: string;
  };
  customer: {
    id?: string;
    name: string;
    mobile?: string;
    email?: string;
  };
  amount: number;
  razorpayId: string;
  method: 'razorpay' | 'cod';
  status: 'pending' | 'captured' | 'failed' | 'refunded';
  date: string;
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
  isActive?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  orderCount: number;
  lastOrderDate?: string;
  totalSpend: number;
  isActive?: boolean;
}

export interface AdminSearchResults {
  orders: Array<Pick<Order, 'id' | 'orderNumber' | 'status' | 'totalAmount' | 'createdAt'>>;
  products: Array<Pick<Product, 'id' | 'name' | 'slug' | 'images' | 'isActive'>>;
  customers: Array<Pick<Customer, 'id' | 'name' | 'mobile' | 'email'>>;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  activeProducts: number;
}

export interface RevenueSeriesPoint {
  date: string;
  totalRevenue: number;
  [key: string]: number | string;
}

export interface TopProduct {
  productName: string;
  storeName: string;
  unitsSold: number;
  revenue: number;
}

export interface DashboardAnalytics {
  stats: DashboardStats;
  revenueByStore: Array<{
    storeId: string;
    storeName: string;
    revenue: number;
    orders: number;
    color: string;
  }>;
  revenueTimeline: {
    range: '30d' | '60d' | '90d';
    stores: Array<{
      storeId: string;
      storeName: string;
      color: string;
      key: string;
    }>;
    points: RevenueSeriesPoint[];
  };
  orderStatusBreakdown: Array<{
    status: OrderStatusHistoryEntry['status'];
    count: number;
  }>;
  topProducts: TopProduct[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export interface StoreSummary extends StoreSettings {
  admin?: {
    id: string;
    name: string;
    email?: string;
    mobile?: string;
    isActive?: boolean;
  } | null;
  adminName: string;
  totalOrders: number;
  totalRevenue: number;
  hasSecrets: boolean;
  secrets: Record<string, string>;
}

export interface AdminAccount {
  id: string;
  name: string;
  email?: string;
  mobile: string;
  profileImage?: {
    url: string;
    publicId: string;
  } | null;
  role: 'storeAdmin';
  isActive: boolean;
  status: 'active' | 'inactive';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  storeName?: string;
  storeLocation?: string;
  longitude?: number;
  latitude?: number;
  gstNumber?: string;
  sgstNumber?: string;
  assignedStore?: {
    id: string;
    name: string;
    isActive: boolean;
  } | null;
}

export interface ProductRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  productName: string;
  requestedQuantity: number;
  requestedPack?: string;
  notes?: string;
  superAdminNote?: string;
  createdAt: string;
  store: {
    id: string;
    name: string;
  };
  requestedBy: {
    id: string;
    name: string;
    mobile?: string;
  };
}

export interface Testimonial {
  id: string;
  name: string;
  designation?: string;
  avatar?: {
    url: string;
    publicId: string;
  };
  message: string;
  rating: number;
  storeId?: {
    id?: string;
    name?: string;
  } | string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface SiteSettings {
  id: string;
  platformName: string;
  supportEmail?: string;
  supportPhone?: string;
  maintenanceMode: boolean;
  homepageHeadline?: string;
  defaultDeliveryRadius: number;
  allowGuestCheckout: boolean;
  metaTitle?: string;
  metaDescription?: string;
}

export interface StoreSecretsResponse {
  storeId: string;
  storeName: string;
  secrets: Record<string, string>;
}

export interface PaymentSummary {
  totalCaptured: number;
  totalFailed: number;
  totalRefunded: number;
}
