import { useAuthStore } from '../store/useAuthStore';
import { API_BASE_URL } from '../config/api';

const REQUEST_TIMEOUT_MS = 25_000;

// ─── HTTP Helper ──────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE_URL}${path}`;
  if (params) {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (query) url += `?${query}`;
  }

  const token = useAuthStore.getState().token;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions.headers,
      },
    });

    let data: any;
    try {
      data = await res.json();
    } catch {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return {} as T;
    }

    if (!res.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Dealer API ───────────────────────────────────────────────────────────

export const dealerApi = {
  // Auth
  sendOtp: (phone: string) =>
    request<{ verificationId: string; message: string }>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile: phone }),
    }),

  verifyOtp: (phone: string, otp: string, verificationId?: string) =>
    request<{ user: any; token: string }>('/auth/login-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile: phone, otp, verificationId }),
    }),

  // Products (bulk catalogue with MOQ)
  getBulkCatalogue: (params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
  }) =>
    request<{ success: boolean; data: any[]; pagination: any }>('/products/bulk-catalogue', {
      params: params as any,
    }),

  getProductBySlug: (slug: string) =>
    request<{ success: boolean; data: any }>(`/products/${slug}`),

  // Dealer orders — uses admin orders endpoint with dealer token
  getMyOrders: (params?: { page?: number; limit?: number; status?: string }) =>
    request<{ success: boolean; data: any[]; pagination: any }>('/admin/orders', {
      params: params as any,
    }),

  getOrderById: (id: string) =>
    request<{ success: boolean; data: any }>(`/admin/orders/${id}`),

  // B2B invoices
  getInvoices: (params?: { page?: number; limit?: number }) =>
    request<{ success: boolean; data: any[]; pagination: any }>('/admin/b2b-invoices', {
      params: params as any,
    }),

  // Settlements
  getSettlements: () =>
    request<{ success: boolean; data: any[] }>('/admin/settlements'),

  getSettlementEligibleOrders: () =>
    request<any[]>('/admin/settlement-eligible-orders'),

  // Analytics
  getAnalytics: (range: '7d' | '30d') =>
    request<{ success: boolean; data: any }>('/admin/analytics', {
      params: { range },
    }),

  // Referrals
  getReferrals: () =>
    request<{ success: boolean; data: any }>('/admin/referrals'),

  // Profile
  getProfile: () =>
    request<{ success: boolean; data: any }>('/auth/me'),

  updateProfile: (data: Partial<{ name: string; email: string }>) =>
    request<{ success: boolean; data: any }>('/auth/update-profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Checkout / Place Order
  initiateOrder: (payload: {
    items: { productId: string; variantId: string; qty: number }[];
    paymentMethod: 'razorpay' | 'cod';
    deliveryAddress?: any;
  }) =>
    request<{ success: boolean; data: any }>('/orders/initiate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  confirmOrder: (payload: { orderId: string; razorpayPaymentId?: string; razorpaySignature?: string }) =>
    request<{ success: boolean; data: any }>('/orders/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Notifications
  registerPushToken: (token: string) =>
    request<{ success: boolean }>('/auth/push-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};
