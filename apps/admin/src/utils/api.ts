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

api.interceptors.request.use((config) => {
  const token = useAdminAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const adminApi = {
  login: async (payload: { mobile: string; password: string }) => {
    const response = await api.post<ApiResponse<{ user: AuthUser; accessToken: string }>>('/auth/login', payload);
    return response.data.data;
  },
  me: async () => {
    const response = await api.get<ApiResponse<AuthUser>>('/auth/me');
    return response.data.data;
  },
  logout: async () => {
    const response = await api.post<{ success: boolean; message: string }>('/auth/logout');
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
};
