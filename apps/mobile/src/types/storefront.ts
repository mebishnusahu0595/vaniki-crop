export type ServiceMode = 'delivery' | 'pickup';

export interface Address {
  street: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface ImageAsset {
  url: string;
  publicId?: string;
  mobileUrl?: string;
  isPrimary?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: ImageAsset;
}

export interface ProductVariant {
  id: string;
  label: string;
  price: number;
  mrp: number;
  stock: number;
  sku?: string;
}

export interface StoreLocation {
  type: 'Point';
  coordinates: [number, number];
}

export interface Store {
  id: string;
  name: string;
  address: Address;
  phone: string;
  email?: string;
  openHours?: Partial<
    Record<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', string>
  >;
  location?: StoreLocation;
  deliveryRadius?: number;
}

export interface ReviewUser {
  name: string;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt?: string;
  userId?: ReviewUser;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  images: ImageAsset[];
  category?: Category;
  variants: ProductVariant[];
  tags?: string[];
  averageRating?: number;
  reviewCount?: number;
  totalSold?: number;
  storeId?: string[] | Store[];
  brand?: string;
  sku?: string;
  reviews?: Review[];
}

export interface HomepageBanner {
  id: string;
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
  image: ImageAsset;
  linkedProducts: Array<{
    productId: Product;
    position: number;
  }>;
}

export interface Testimonial {
  id: string;
  name: string;
  designation?: string;
  avatar?: ImageAsset;
  message: string;
  rating: number;
}

export interface HomepageData {
  banners: HomepageBanner[];
  featuredCategories: Category[];
  saleProducts: Product[];
  bestSellers: Product[];
  testimonials: Testimonial[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductListResponse {
  data: Product[];
  pagination: PaginationMeta;
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
  serviceMode: ServiceMode;
  items: OrderItem[];
  subtotal: number;
  couponCode?: string;
  couponDiscount: number;
  deliveryCharge: number;
  totalAmount: number;
  shippingAddress?: Address & { name: string; mobile: string };
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod: 'razorpay' | 'cod';
  status: OrderStatusHistoryEntry['status'];
  statusHistory: OrderStatusHistoryEntry[];
  createdAt: string;
  storeId?: Store;
}

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  mobile: string;
  role: 'customer' | 'storeAdmin' | 'superAdmin';
  selectedStore?: Store | string | null;
  serviceMode: ServiceMode;
  savedAddress?: Address;
}

export interface CouponValidation {
  valid: boolean;
  message: string;
  discount?: number;
}

export interface OrderInitiationSummary {
  subtotal: number;
  couponDiscount: number;
  deliveryCharge: number;
  totalAmount: number;
  items: OrderItem[];
}

export interface OrderInitiationResponse {
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: number;
  currency: string;
  orderSummary: OrderInitiationSummary;
}

export interface OrderConfirmationResponse {
  orderId: string;
  orderNumber: string;
}

export interface SearchResult {
  data: Product[];
  total: number;
}
