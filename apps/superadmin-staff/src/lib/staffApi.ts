import { API_BASE_URL } from '../config/api';
import { useStaffAuthStore, type DeliveryStaff } from '../store/useStaffAuthStore';
import type { Address, OrderItem, OrderStatusHistoryEntry } from '../types/storefront';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

export interface DeliveryTask {
  id: string;
  _id?: string;
  orderNumber: string;
  status: OrderStatusHistoryEntry['status'];
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod: 'razorpay' | 'cod';
  totalAmount: number;
  createdAt: string;
  deliveryOtp?: string;
  deliveryAssignedAt?: string;
  deliveryDeliveredAt?: string;
  deliveryProofDescription?: string;
  deliveryCancelReason?: string;
  deliveryCancelNote?: string;
  shippingAddress?: Address & { name?: string; mobile?: string };
  items: OrderItem[];
  userId?: {
    id?: string;
    name?: string;
    mobile?: string;
    email?: string;
    savedAddress?: Address;
  };
  storeId?: {
    id?: string;
    name?: string;
    phone?: string;
    address?: Address;
  };
  statusHistory: OrderStatusHistoryEntry[];
}

function normalizeStaff(staff: any) {
  return {
    ...staff,
    id: staff.id || staff._id || '',
  };
}

function normalizeTask(task: DeliveryTask) {
  return {
    ...task,
    id: task.id || task._id || '',
  };
}

async function request<T>(path: string, options: RequestOptions = {}) {
  const token = useStaffAuthStore.getState().token;
  const url = new URL(`${API_BASE_URL}${path}`);

  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const json = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok) {
    if (response.status === 401) {
      useStaffAuthStore.getState().logout();
    }
    throw new Error(json.error || json.message || 'Request failed.');
  }

  return json;
}

export const staffApi = {
  login: async (payload: { mobile: string; password: string }) => {
    const response = await request<{ user: any; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (response.data.user.role !== 'superAdmin') {
      throw new Error('Access denied. Superadmin privileges required.');
    }
    return {
      accessToken: response.data.accessToken,
      staff: normalizeStaff(response.data.user),
    };
  },
  me: async () => {
    const response = await request<any>('/auth/me');
    return normalizeStaff(response.data);
  },
  tasks: async () => {
    const response = await request<DeliveryTask[]>('/orders/super-admin/list');
    return (response.data || []).map(normalizeTask);
  },
  updateFcmToken: async (fcmToken: string) => {
    const response = await request<any>('/auth/fcm-token', {
      method: 'PATCH',
      body: JSON.stringify({ fcmToken }),
    });
    return response.data;
  },
};
