import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { useAuthStore } from '../store/useAuthStore';
import { useStoreStore } from '../store/useStoreStore';
import type {
  AuthUser,
  Category,
  CouponValidation,
  HomepageData,
  Order,
  OrderConfirmationResponse,
  OrderInitiationResponse,
  PaginationMeta,
  Product,
  ProductListResponse,
  SearchResult,
  ServiceMode,
  Store,
} from '../types/storefront';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Request interceptor to add Auth token and Store ID
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  const storeId = useStoreStore.getState().selectedStore?.id;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (storeId) {
    config.headers['X-Store-Id'] = storeId;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
  message?: string;
}

type VariantLike = Product['variants'][number] & {
  _id?: string;
};

type ReviewLike = NonNullable<Product['reviews']>[number] & {
  _id?: string;
};

type ProductLike = Product & {
  _id?: string;
  variants?: VariantLike[];
  reviews?: ReviewLike[];
};

const normalizeVariant = (variant: VariantLike, index: number): Product['variants'][number] => ({
  ...variant,
  id: variant.id || variant._id || variant.sku || `${variant.label || 'variant'}-${index}`,
});

const normalizeProduct = (product: ProductLike | null | undefined): Product | undefined => {
  if (!product) return undefined;

  const normalizedReviews = (product.reviews || []).map((review, index) => {
    const reviewLike = review as ReviewLike;
    return {
      ...reviewLike,
      id: reviewLike.id || reviewLike._id || `review-${index}`,
    };
  });

  return {
    ...product,
    id: product.id || product._id || product.slug,
    variants: (product.variants || []).map((variant, index) => normalizeVariant(variant, index)),
    reviews: normalizedReviews,
  } as Product;
};

const normalizeProducts = (products: ProductLike[] = []): Product[] =>
  products.map((product) => normalizeProduct(product) as Product);

const normalizeHomepageData = (homepage: HomepageData): HomepageData => ({
  ...homepage,
  saleProducts: normalizeProducts(homepage.saleProducts as ProductLike[]),
  bestSellers: normalizeProducts(homepage.bestSellers as ProductLike[]),
  banners: (homepage.banners || []).map((banner) => ({
    ...banner,
    linkedProducts: (banner.linkedProducts || []).map((entry) => ({
      ...entry,
      productId: normalizeProduct(entry.productId as ProductLike) as Product,
    })),
  })),
});

export const storefrontApi = {
  homepage: async (storeId?: string) => {
    const response = await api.get<ApiResponse<HomepageData>>('/homepage', {
      params: storeId ? { storeId } : undefined,
    });
    return normalizeHomepageData(response.data.data);
  },
  categories: async () => {
    const response = await api.get<ApiResponse<Category[]>>('/categories');
    return response.data.data;
  },
  products: async (params?: Record<string, string | number | undefined>) => {
    const response = await api.get<PaginatedResponse<Product>>('/products', { params });
    return {
      data: normalizeProducts(response.data.data as ProductLike[]),
      pagination: response.data.pagination,
    } satisfies ProductListResponse;
  },
  searchProducts: async (query: string, storeId?: string) => {
    const response = await api.get<ApiResponse<Product[]> & { total: number }>('/products/search', {
      params: {
        q: query,
        ...(storeId ? { storeId } : {}),
        limit: 6,
      },
    });
    return {
      data: normalizeProducts(response.data.data as ProductLike[]),
      total: response.data.total,
    } satisfies SearchResult;
  },
  productDetail: async (slug: string) => {
    const response = await api.get<ApiResponse<Product>>(`/products/${slug}`);
    return normalizeProduct(response.data.data as ProductLike) as Product;
  },
  stores: async () => {
    const response = await api.get<ApiResponse<Store[]>>('/stores');
    return response.data.data;
  },
  validateCoupon: async (payload: { code: string; storeId: string; cartTotal: number }) => {
    const response = await api.post<ApiResponse<CouponValidation>>('/coupons/validate', payload);
    return response.data.data;
  },
  initiateOrder: async (payload: Record<string, unknown>) => {
    const response = await api.post<ApiResponse<OrderInitiationResponse>>('/orders/initiate', payload);
    return response.data.data;
  },
  confirmOrder: async (payload: Record<string, unknown>) => {
    const response = await api.post<ApiResponse<OrderConfirmationResponse>>('/orders/confirm', payload);
    return response.data.data;
  },
  placeCodOrder: async (payload: Record<string, unknown>) => {
    const response = await api.post<ApiResponse<OrderConfirmationResponse>>('/orders/place-cod', payload);
    return response.data.data;
  },
  orders: async (page = 1) => {
    const response = await api.get<PaginatedResponse<Order>>('/orders/my', {
      params: { page, limit: 10 },
    });
    return {
      data: response.data.data,
      pagination: response.data.pagination,
    };
  },
  orderDetail: async (id: string) => {
    const response = await api.get<ApiResponse<Order>>(`/orders/${id}`);
    return response.data.data;
  },
  submitReview: async (payload: { productId: string; rating: number; comment?: string }) => {
    const response = await api.post<ApiResponse<unknown>>('/reviews', payload);
    return response.data;
  },
  contact: async (payload: { name: string; email: string; mobile?: string; subject: string; message: string }) => {
    const response = await api.post<{ success: boolean; message: string }>('/contact', payload);
    return response.data;
  },
  login: async (payload: { mobile: string; password: string }) => {
    const response = await api.post<ApiResponse<{ user: AuthUser; accessToken: string }>>('/auth/login', payload);
    return response.data.data;
  },
  sendOtp: async (mobile: string) => {
    const response = await api.post<{ success: boolean; message: string }>('/auth/send-otp', { mobile });
    return response.data;
  },
  signup: async (payload: { name: string; email?: string; mobile: string; password: string; otp: string; referralCode?: string }) => {
    const response = await api.post<ApiResponse<{ user: AuthUser; accessToken: string }>>('/auth/signup', payload);
    return response.data.data;
  },
  forgotPassword: async (mobile: string) => {
    const response = await api.post<{ success: boolean; message: string }>('/auth/forgot-password', { mobile });
    return response.data;
  },
  resetPassword: async (payload: { mobile: string; otp: string; newPassword: string }) => {
    const response = await api.post<{ success: boolean; message: string }>('/auth/reset-password', payload);
    return response.data;
  },
  me: async () => {
    const response = await api.get<ApiResponse<AuthUser>>('/auth/me');
    return response.data.data;
  },
  updateMe: async (payload: Partial<AuthUser> & { savedAddress?: AuthUser['savedAddress'] }) => {
    const response = await api.patch<ApiResponse<AuthUser>>('/auth/me', payload);
    return response.data.data;
  },
  changePassword: async (payload: { currentPassword: string; newPassword: string }) => {
    const response = await api.patch<{ success: boolean; message: string }>('/auth/change-password', payload);
    return response.data;
  },
  updateServiceMode: async (serviceMode: ServiceMode) => {
    const response = await api.patch<ApiResponse<AuthUser>>('/auth/service-mode', { serviceMode });
    return response.data.data;
  },
  toggleWishlist: async (productId: string) => {
    const response = await api.patch<ApiResponse<AuthUser>>('/auth/wishlist/toggle', { productId });
    return response.data.data;
  },
  selectStore: async (storeId: string) => {
    const response = await api.post<{ success: boolean; message: string }>('/stores/select', { storeId });
    return response.data;
  },
  logout: async () => {
    const response = await api.post<{ success: boolean; message: string }>('/auth/logout');
    return response.data;
  },
};

export default api;
