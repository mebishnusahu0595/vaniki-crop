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
      throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    }

    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Dealer API ───────────────────────────────────────────────────────────

export const dealerApi = {
  // Auth
  sendOtp: async (phone: string) => {
    try {
      return await request<{ verificationId?: string; message?: string; data?: { verificationId?: string } }>(
        '/auth/send-login-otp',
        {
          method: 'POST',
          body: JSON.stringify({ mobile: phone }),
        },
      );
    } catch (e: any) {
      return await request<{ verificationId?: string; message?: string; data?: { verificationId?: string } }>(
        '/auth/send-otp',
        {
          method: 'POST',
          body: JSON.stringify({ mobile: phone }),
        },
      );
    }
  },

  verifyOtp: async (phone: string, otp: string, verificationId?: string) => {
    const res = await request<any>('/auth/login-otp', {
      method: 'POST',
      body: JSON.stringify({
        mobile: phone,
        otp: String(otp).trim(),
        verificationId: verificationId || undefined,
      }),
    });
    const user = res?.user || res?.data?.user;
    const token = res?.token || res?.accessToken || res?.data?.accessToken || res?.data?.token;
    return { user, token, data: { user, accessToken: token } };
  },

  sendRegistrationOtp: async (phone: string) => {
    return await request<{ success: boolean; message: string; verificationId?: string; data?: { verificationId?: string } }>(
      '/auth/send-otp',
      {
        method: 'POST',
        body: JSON.stringify({ mobile: phone }),
      },
    );
  },

  verifyRegistrationOtp: async (phone: string, otp: string) => {
    return await request<{ success: boolean; message: string; data?: any }>(
      '/auth/verify-otp',
      {
        method: 'POST',
        body: JSON.stringify({
          mobile: phone,
          otp: String(otp).trim(),
        }),
      },
    );
  },

  dealerSignup: async (payload: any) => {
    const res = await request<any>('/auth/dealer-signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const user = res?.user || res?.data?.user;
    const accessToken = res?.accessToken || res?.token || res?.data?.accessToken || res?.data?.token;
    return { user, accessToken, data: { user, accessToken } };
  },

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

  // Dealer Promotions (from SuperAdmin -> Dealers Promotions)
  getPromotions: () =>
    request<{ success: boolean; data: any[] }>('/promotions/dealers'),

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
  getInvoices: (params?: { page?: number; limit?: number; search?: string }) =>
    request<{ success: boolean; data: any[]; pagination: any }>('/b2b-invoices/admin/list', {
      params: params as any,
    }),

  getPaymentDetails: () =>
    request<{ success: boolean; data: any }>('/b2b-invoices/payment-details'),

  submitInvoicePayment: (id: string, formData: FormData) => {
    const token = useAuthStore.getState().token;
    return fetch(`${API_BASE_URL}/b2b-invoices/${id}/submit-payment`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to submit payment proof');
      return data;
    });
  },

  // Garages for product stock requests
  getGarages: () =>
    request<{ success: boolean; data: string[] }>('/admin/garages'),

  // Submit product requests batch to Superadmin
  createProductRequest: (payload: any) =>
    request<{ success: boolean; data: any }>('/admin/product-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Get dealer's stock procurement requests
  getProductRequests: (params?: { status?: string; page?: number; limit?: number }) =>
    request<{ success: boolean; data: any[]; pagination?: any }>('/admin/product-requests', {
      params,
    }),

  // Password Login
  loginPassword: async (mobile: string, password: string) => {
    const res = await request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ mobile, password }),
    });
    const user = res?.user || res?.data?.user;
    const token = res?.token || res?.accessToken || res?.data?.accessToken || res?.data?.token;
    return { user, token, data: { user, accessToken: token } };
  },

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
