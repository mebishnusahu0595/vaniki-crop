import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storefrontApi } from '../utils/api';
import { useAuthStore } from './useAuthStore';

export interface CartItem {
  productId: string;
  variantId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  price: number;
  mrp: number;
  qty: number;
  image?: string;
  stock?: number;
}

export const getCartSessionId = (): string => {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('vaniki_cart_session_id');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem('vaniki_cart_session_id', id);
  }
  return id;
};

let cachedCoordinates: { latitude: number; longitude: number; accuracy?: number } | null = null;

if (typeof window !== 'undefined') {
  try {
    const saved = sessionStorage.getItem('vaniki_user_coords');
    if (saved) cachedCoordinates = JSON.parse(saved);
  } catch (_) {}

  // Non-intrusively check if geolocation permission is already granted
  if ('permissions' in navigator) {
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (status.state === 'granted') {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              cachedCoordinates = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              };
              try {
                sessionStorage.setItem('vaniki_user_coords', JSON.stringify(cachedCoordinates));
              } catch (_) {}
            },
            () => {},
            { timeout: 5000, maximumAge: 120000 },
          );
        }
      })
      .catch(() => {});
  }
}

export const requestOrGetWebCoordinates = (): Promise<{ latitude: number; longitude: number; accuracy?: number } | null> => {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve(null);
  }
  if (cachedCoordinates) {
    return Promise.resolve(cachedCoordinates);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        cachedCoordinates = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        try {
          sessionStorage.setItem('vaniki_user_coords', JSON.stringify(cachedCoordinates));
        } catch (_) {}
        resolve(cachedCoordinates);
      },
      () => resolve(null),
      { timeout: 5000, maximumAge: 120000 },
    );
  });
};

let syncTimeout: any = null;

export const triggerCartSync = (immediate = false) => {
  if (typeof window === 'undefined') return;
  if (syncTimeout) clearTimeout(syncTimeout);

  const performSync = async () => {
    try {
      const state = useCartStore.getState();
      const authState = useAuthStore.getState();
      const user = authState.user;
      const sessionId = getCartSessionId();

      const customerName = state.customerName || user?.name || '';
      const customerPhone = state.customerPhone || user?.mobile || '';
      const customerEmail = state.customerEmail || user?.email || '';

      // Direct coordinates if permission is granted
      let coords = cachedCoordinates;
      if (!coords && 'permissions' in navigator) {
        try {
          const perm = await navigator.permissions.query({ name: 'geolocation' });
          if (perm.state === 'granted') {
            coords = await requestOrGetWebCoordinates();
          }
        } catch (_) {}
      }

      await storefrontApi.syncCart({
        sessionId,
        items: state.items,
        couponCode: state.couponCode,
        couponDiscount: state.couponDiscount,
        source: 'user_web',
        userType: user
          ? user.role === 'storeAdmin' || (user as any).role === 'dealer'
            ? 'dealer'
            : 'user'
          : 'guest',
        customerName,
        customerPhone,
        customerEmail,
        coordinates: coords || undefined,
      });
    } catch (err) {
      console.debug('Background cart sync:', err);
    }
  };

  if (immediate) {
    performSync();
  } else {
    syncTimeout = setTimeout(performSync, 350);
  }
};

interface CartState {
  items: CartItem[];
  couponCode: string;
  couponDiscount: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId: string) => void;
  updateQty: (productId: string, variantId: string, qty: number) => void;
  clearCart: () => void;
  setCouponCode: (couponCode: string, couponDiscount: number) => void;
  clearCoupon: () => void;
  setCustomerInfo: (info: { name?: string; phone?: string; email?: string }) => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: '',
      couponDiscount: 0,
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      addItem: (newItem) => {
        const { items } = get();
        const existingItem = items.find(
          (item) => item.productId === newItem.productId && item.variantId === newItem.variantId
        );

        if (existingItem) {
          set({
            items: items.map((item) =>
              item.productId === newItem.productId && item.variantId === newItem.variantId
                ? { ...item, qty: item.qty + newItem.qty }
                : item
            ),
          });
        } else {
          set({ items: [...items, newItem] });
        }
        triggerCartSync();
      },
      removeItem: (productId, variantId) => {
        set({
          items: get().items.filter(
            (item) => item.productId !== productId || item.variantId !== variantId
          ),
        });
        triggerCartSync();
      },
      updateQty: (productId, variantId, qty) => {
        set({
          items: get().items.map((item) =>
            item.productId === productId && item.variantId === variantId
              ? { ...item, qty: Math.max(1, qty) }
              : item
          ),
        });
        triggerCartSync();
      },
      clearCart: () => {
        set({ items: [], couponCode: '', couponDiscount: 0 });
        triggerCartSync(true);
      },
      setCouponCode: (couponCode, couponDiscount) => {
        set({ couponCode, couponDiscount });
        triggerCartSync();
      },
      clearCoupon: () => {
        set({ couponCode: '', couponDiscount: 0 });
        triggerCartSync();
      },
      setCustomerInfo: (info) => {
        set((state) => ({
          customerName: info.name !== undefined ? info.name : state.customerName,
          customerPhone: info.phone !== undefined ? info.phone : state.customerPhone,
          customerEmail: info.email !== undefined ? info.email : state.customerEmail,
        }));
        triggerCartSync();
      },
      getTotalItems: () => get().items.reduce((acc, item) => acc + item.qty, 0),
      getSubtotal: () => get().items.reduce((acc, item) => acc + item.price * item.qty, 0),
    }),
    {
      name: 'vaniki-cart',
      onRehydrateStorage: () => (state) => {
        if (state && state.items && state.items.length > 0) {
          triggerCartSync(false);
        }
      },
    }
  )
);
