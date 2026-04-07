import axios from 'axios';
import { useAdminAuthStore } from '../store/useAdminAuthStore';
import type {
  AdminSearchResults,
  AdminAccount,
  AuthUser,
  Banner,
  Category,
  Coupon,
  Customer,
  DashboardAnalytics,
  Order,
  PaginationMeta,
  Payment,
  PaymentSummary,
  Product,
  Review,
  SiteSettings,
  StoreSecretsResponse,
  StoreSummary,
  Testimonial,
} from '../types/admin';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: PaginationMeta;
  summary?: PaymentSummary;
}

const api = axios.create({
  baseURL: API_BASE,
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
  analytics: async (range: '30d' | '60d' | '90d') => {
    const response = await api.get<ApiResponse<DashboardAnalytics>>('/superadmin/analytics', { params: { range } });
    return response.data.data;
  },
  search: async (q: string): Promise<AdminSearchResults> => {
    void q;
    return { orders: [], products: [], customers: [] };
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
  deleteCategory: async (id: string) => {
    const response = await api.delete<ApiResponse<Category>>(`/admin/categories/${id}`);
    return response.data.data;
  },
  orders: async (params?: Record<string, unknown>) => {
    const response = await api.get<ApiResponse<Order[]>>('/superadmin/orders', { params });
    return { data: response.data.data, pagination: response.data.pagination! };
  },
  orderDetail: async (id: string) => {
    const response = await api.get<ApiResponse<Order>>(`/superadmin/orders/${id}`);
    return response.data.data;
  },
  updateOrderStatus: async (id: string, payload: { status: string; note?: string }) => {
    const response = await api.patch<ApiResponse<Order>>(`/superadmin/orders/${id}/status`, payload);
    return response.data.data;
  },
  customers: async (params?: Record<string, unknown>) => {
    const response = await api.get<ApiResponse<Customer[]>>('/superadmin/customers', { params });
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
    const response = await api.get<ApiResponse<Payment[]>>('/superadmin/payments', { params });
    return {
      data: response.data.data,
      pagination: response.data.pagination!,
      summary: response.data.summary!,
    };
  },
  stores: async (params?: Record<string, unknown>) => {
    const response = await api.get<ApiResponse<StoreSummary[]>>('/superadmin/stores', { params });
    return { data: response.data.data, pagination: response.data.pagination! };
  },
  createStore: async (payload: Record<string, unknown>) => {
    const response = await api.post<ApiResponse<StoreSummary>>('/superadmin/stores', payload);
    return response.data.data;
  },
  updateStore: async (id: string, payload: Record<string, unknown>) => {
    const response = await api.put<ApiResponse<StoreSummary>>(`/superadmin/stores/${id}`, payload);
    return response.data.data;
  },
  toggleStoreActive: async (id: string, isActive: boolean) => {
    const response = await api.patch<ApiResponse<StoreSummary>>(`/superadmin/stores/${id}/toggle-active`, {
      isActive,
    });
    return response.data.data;
  },
  reassignStoreAdmin: async (id: string, adminId: string) => {
    const response = await api.patch<ApiResponse<StoreSummary>>(`/superadmin/stores/${id}/reassign-admin`, {
      adminId,
    });
    return response.data.data;
  },
  admins: async (params?: Record<string, unknown>) => {
    const response = await api.get<ApiResponse<AdminAccount[]>>('/superadmin/admins', { params });
    return { data: response.data.data, pagination: response.data.pagination! };
  },
  createAdmin: async (payload: Record<string, unknown>) => {
    const response = await api.post<ApiResponse<AdminAccount>>('/superadmin/admins', payload);
    return response.data.data;
  },
  updateAdmin: async (id: string, payload: Record<string, unknown>) => {
    const response = await api.patch<ApiResponse<AdminAccount>>(`/superadmin/admins/${id}`, payload);
    return response.data.data;
  },
  deactivateAdmin: async (id: string) => {
    const response = await api.patch<ApiResponse<AdminAccount>>(`/superadmin/admins/${id}/deactivate`);
    return response.data.data;
  },
  testimonials: async (params?: Record<string, unknown>) => {
    const response = await api.get<ApiResponse<Testimonial[]>>('/superadmin/testimonials', { params });
    return { data: response.data.data, pagination: response.data.pagination! };
  },
  createTestimonial: async (payload: FormData) => {
    const response = await api.post<ApiResponse<Testimonial>>('/superadmin/testimonials', payload);
    return response.data.data;
  },
  updateTestimonial: async (id: string, payload: FormData) => {
    const response = await api.put<ApiResponse<Testimonial>>(`/superadmin/testimonials/${id}`, payload);
    return response.data.data;
  },
  toggleTestimonial: async (id: string, isActive: boolean) => {
    const response = await api.patch<ApiResponse<Testimonial>>(`/superadmin/testimonials/${id}/toggle`, {
      isActive,
    });
    return response.data.data;
  },
  reorderTestimonials: async (testimonials: Array<{ id: string; sortOrder: number }>) => {
    const response = await api.patch<ApiResponse<{ success: boolean }>>('/superadmin/testimonials/reorder', {
      testimonials,
    });
    return response.data.data;
  },
  deleteTestimonial: async (id: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(`/superadmin/testimonials/${id}`);
    return response.data;
  },
  siteSettings: async () => {
    const response = await api.get<ApiResponse<SiteSettings>>('/superadmin/site-settings');
    return response.data.data;
  },
  updateSiteSettings: async (payload: Record<string, unknown>) => {
    const response = await api.patch<ApiResponse<SiteSettings>>('/superadmin/site-settings', payload);
    return response.data.data;
  },
  storeSecrets: async (storeId: string) => {
    const response = await api.get<ApiResponse<StoreSecretsResponse>>(`/superadmin/stores/${storeId}/secrets`);
    return response.data.data;
  },
  updateStoreSecrets: async (storeId: string, secrets: Record<string, string | null>) => {
    const response = await api.patch<ApiResponse<StoreSecretsResponse>>(`/superadmin/stores/${storeId}/secrets`, {
      secrets,
    });
    return response.data.data;
  },
};
