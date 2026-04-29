import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { useAdminAuthStore } from '../store/useAdminAuthStore';
import type {
  AdminSearchResults,
  AuthUser,
  Banner,
  Category,
  Coupon,
  Customer,
  DashboardAnalytics,
  DealerInventoryProduct,
  DealerProductRequest,
  Order,
  PaginationMeta,
  Payment,
  Product,
  Review,
  StoreSettings,
} from '../types/admin';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: PaginationMeta;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

function extractApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data as {
      error?: unknown;
      message?: unknown;
    } | undefined;

    const responseError = typeof responseData?.error === 'string' ? responseData.error : '';
    const responseMessage = typeof responseData?.message === 'string' ? responseData.message : '';

    if (responseError) return responseError;
    if (responseMessage) return responseMessage;
    if (typeof error.message === 'string' && error.message.trim()) return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Request failed. Please check input and try again.';
}

api.interceptors.request.use((config) => {
  const token = useAdminAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useAdminAuthStore.getState().clearSession();
    }

    const normalizedError = new Error(extractApiErrorMessage(error));
    if (axios.isAxiosError(error)) {
      (normalizedError as Error & { status?: number; details?: unknown }).status = error.response?.status;
      (normalizedError as Error & { status?: number; details?: unknown }).details = error.response?.data;
    }

    return Promise.reject(normalizedError);
  },
);

export const adminApi = {
  dealerSignup: async (payload: FormData) => {
    const response = await api.post<{ success: boolean; message: string }>('/auth/dealer-signup', payload);
    return response.data;
  },
  login: async (payload: { mobile: string; password: string }) => {
    const response = await api.post<ApiResponse<{ user: AuthUser; accessToken: string }>>('/auth/login', payload);
    return response.data.data;
  },
  me: async () => {
    const response = await api.get<ApiResponse<AuthUser>>('/auth/me');
    return response.data.data;
  },
  updateMe: async (payload: {
    name?: string;
    email?: string;
    mobile?: string;
    savedAddress?: {
      street?: string;
      city?: string;
      state?: string;
      pincode?: string;
      landmark?: string;
    };
  }) => {
    const response = await api.patch<ApiResponse<AuthUser>>('/auth/me', payload);
    return response.data.data;
  },
  updateProfileImage: async (file: File) => {
    const payload = new FormData();
    payload.append('profileImage', file);
    const response = await api.patch<ApiResponse<AuthUser>>('/auth/me/profile-image', payload);
    return response.data.data;
  },
  logout: async () => {
    const response = await api.post<{ success: boolean; message: string }>('/auth/logout');
    return response.data;
  },
  changePassword: async (payload: { currentPassword: string; newPassword: string }) => {
    const response = await api.patch<{ success: boolean; message: string }>('/auth/change-password', payload);
    return response.data;
  },
  forgotPassword: async (payload: { mobile?: string; email?: string }) => {
    const response = await api.post<{ success: boolean; message: string }>('/auth/forgot-password', payload);
    return response.data;
  },
  resetPassword: async (payload: { mobile?: string; email?: string; otp: string; newPassword: string }) => {
    const response = await api.post<{ success: boolean; message: string }>('/auth/reset-password', payload);
    return response.data;
  },
  analytics: async (range: '7d' | '30d') => {
    const response = await api.get<ApiResponse<DashboardAnalytics>>('/analytics/admin', { params: { range } });
    return response.data.data;
  },
  search: async (q: string) => {
    const response = await api.get<ApiResponse<AdminSearchResults>>('/admin/search', { params: { q } });
    return response.data.data;
  },
  products: async (params?: Record<string, unknown>) => {
    const response = await api.get<ApiResponse<Product[]>>('/admin/products', { params });
    return { data: response.data.data, pagination: response.data.pagination! };
  },
  productDetail: async (id: string) => {
    const response = await api.get<ApiResponse<Product>>(`/admin/products/${id}`);
    return response.data.data;
  },
  createProduct: async (payload: FormData) => {
    const response = await api.post<ApiResponse<Product>>('/admin/products', payload);
    return response.data.data;
  },
  updateProduct: async (id: string, payload: FormData) => {
    const response = await api.put<ApiResponse<Product>>(`/admin/products/${id}`, payload);
    return response.data.data;
  },
  deleteProduct: async (id: string) => {
    const response = await api.delete<ApiResponse<Product>>(`/admin/products/${id}`);
    return response.data.data;
  },
  categories: async (params?: Record<string, unknown>) => {
    const response = await api.get<ApiResponse<Category[]>>('/admin/categories', { params });
    return { data: response.data.data, pagination: response.data.pagination! };
  },
  createCategory: async (payload: FormData) => {
    const response = await api.post<ApiResponse<Category>>('/admin/categories', payload);
    return response.data.data;
  },
  updateCategory: async (id: string, payload: FormData) => {
    const response = await api.put<ApiResponse<Category>>(`/admin/categories/${id}`, payload);
    return response.data.data;
  },
  toggleCategoryActive: async (id: string, isActive: boolean) => {
    const response = await api.patch<ApiResponse<Category>>(`/admin/categories/${id}/toggle-active`, { isActive });
    return response.data.data;
  },
  deleteCategory: async (id: string) => {
    const response = await api.delete<ApiResponse<Category>>(`/admin/categories/${id}`);
    return response.data.data;
  },
  permanentlyDeleteCategory: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/admin/categories/${id}/permanent`);
    return response.data;
  },
  orders: async (params?: Record<string, unknown>) => {
    const response = await api.get<ApiResponse<Order[]>>('/orders/admin/list', { params });
    return { data: response.data.data, pagination: response.data.pagination! };
  },
  orderDetail: async (id: string) => {
    const response = await api.get<ApiResponse<Order>>(`/orders/admin/${id}`);
    return response.data.data;
  },
  updateOrderStatus: async (id: string, payload: { status: string; note?: string }) => {
    const response = await api.patch<ApiResponse<Order>>(`/orders/admin/${id}/status`, payload);
    return response.data.data;
  },
  customers: async (params?: Record<string, unknown>) => {
    const response = await api.get<ApiResponse<Customer[]>>('/admin/customers', { params });
    return { data: response.data.data, pagination: response.data.pagination! };
  },
  coupons: async () => {
    const response = await api.get<ApiResponse<Coupon[]>>('/coupons/admin');
    return response.data.data;
  },
  createCoupon: async (payload: Record<string, unknown>) => {
    const response = await api.post<ApiResponse<Coupon>>('/coupons/admin', payload);
    return response.data.data;
  },
  updateCoupon: async (id: string, payload: Record<string, unknown>) => {
    const response = await api.put<ApiResponse<Coupon>>(`/coupons/admin/${id}`, payload);
    return response.data.data;
  },
  deleteCoupon: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/coupons/admin/${id}`);
    return response.data;
  },
  reviews: async (params?: Record<string, unknown>) => {
    const response = await api.get<ApiResponse<Review[]>>('/reviews/admin', { params });
    return { data: response.data.data, pagination: response.data.pagination! };
  },
  approveReview: async (id: string) => {
    const response = await api.patch<ApiResponse<Review>>(`/reviews/admin/${id}/approve`);
    return response.data.data;
  },
  deleteReview: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/reviews/${id}`);
    return response.data;
  },
  banners: async () => {
    const response = await api.get<ApiResponse<Banner[]>>('/banners/admin');
    return response.data.data;
  },
  createBanner: async (payload: FormData) => {
    const response = await api.post<ApiResponse<Banner>>('/banners/admin', payload);
    return response.data.data;
  },
  updateBanner: async (id: string, payload: FormData) => {
    const response = await api.put<ApiResponse<Banner>>(`/banners/admin/${id}`, payload);
    return response.data.data;
  },
  deleteBanner: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/banners/admin/${id}`);
    return response.data;
  },
  reorderBanners: async (banners: Array<{ id: string; sortOrder: number }>) => {
    const response = await api.patch<{ success: boolean; data: { success: boolean } }>('/banners/admin/reorder', { banners });
    return response.data;
  },
  payments: async (params?: Record<string, unknown>) => {
    const response = await api.get<ApiResponse<Payment[]>>('/payments/admin/list', { params });
    return { data: response.data.data, pagination: response.data.pagination! };
  },
  storeSettings: async () => {
    const response = await api.get<ApiResponse<StoreSettings>>('/stores/admin/me');
    return response.data.data;
  },
  updateStoreSettings: async (payload: Record<string, unknown>) => {
    const response = await api.patch<ApiResponse<StoreSettings>>('/stores/admin/me', payload);
    return response.data.data;
  },
  verifyGst: async (gstin: string) => {
    const response = await api.get<ApiResponse<any>>(`/stores/admin/verify-gst/${gstin}`);
    return response.data.data;
  },
  inventoryProducts: async () => {
    const response = await api.get<ApiResponse<DealerInventoryProduct[]>>('/admin/inventory');
    return response.data.data;
  },
  updateInventory: async (entries: Array<{ productId: string; variantId: string; quantity: number }>) => {
    const response = await api.patch<ApiResponse<DealerInventoryProduct[]>>('/admin/inventory', { entries });
    return response.data.data;
  },
  productRequests: async (params?: Record<string, unknown>) => {
    const response = await api.get<ApiResponse<DealerProductRequest[]>>('/admin/product-requests', { params });
    return { data: response.data.data, pagination: response.data.pagination! };
  },
  createProductRequest: async (payload: {
    productId?: string;
    productName?: string;
    requestedQuantity: number;
    requestedPack?: string;
    garageName: string;
    petiQuantity: number;
    petiSize: number;
    petiUnit: 'Liter' | 'Kg';
    notes?: string;
  }) => {
    const response = await api.post<ApiResponse<DealerProductRequest>>('/admin/product-requests', payload);
    return response.data.data;
  },
};
