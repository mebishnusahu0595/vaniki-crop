import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorage } from '../lib/storage';
import { storefrontApi } from '../lib/api';
import { useAuthStore } from './useAuthStore';
import type { Product, ProductVariant } from '../types/storefront';

export interface CartItem {
  productId: string;
  productSlug: string;
  productName: string;
  image?: string;
  variantId: string;
  variantLabel: string;
  price: number;
  mrp: number;
  qty: number;
  stock?: number;
}

let syncTimeout: any = null;

export const triggerMobileCartSync = (immediate = false) => {
  if (syncTimeout) clearTimeout(syncTimeout);

  const performSync = async () => {
    try {
      const state = useCartStore.getState();
      const auth = useAuthStore.getState();
      const user = auth.user;

      await storefrontApi.syncCart({
        items: state.items,
        couponCode: state.couponCode,
        couponDiscount: state.couponDiscount,
        source: 'user_app',
        userType: user ? 'user' : 'guest',
        customerName: user?.name || '',
        customerPhone: user?.mobile || '',
      });
    } catch (err) {
      console.debug('Mobile background cart sync:', err);
    }
  };

  if (immediate) {
    performSync();
  } else {
    syncTimeout = setTimeout(performSync, 400);
  }
};

interface CartState {
  items: CartItem[];
  couponCode: string;
  couponDiscount: number;
  addItem: (product: Product, variant: ProductVariant) => void;
  increaseQty: (variantId: string) => void;
  decreaseQty: (variantId: string) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  setCouponCode: (code: string, discount: number) => void;
  clearCoupon: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      couponCode: '',
      couponDiscount: 0,
      addItem: (product, variant) => {
        set((state) => {
          const existing = state.items.find((item) => item.variantId === variant.id);
          if (existing) {
            return {
              items: state.items.map((item) =>
                item.variantId === variant.id ? { ...item, qty: item.qty + 1 } : item,
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                productSlug: product.slug,
                productName: product.name,
                image: product.images?.[0]?.url,
                variantId: variant.id,
                variantLabel: variant.label,
                price: variant.price,
                mrp: variant.mrp,
                qty: 1,
                stock: variant.stock,
              },
            ],
          };
        });
        triggerMobileCartSync();
      },
      increaseQty: (variantId) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.variantId === variantId ? { ...item, qty: item.qty + 1 } : item,
          ),
        }));
        triggerMobileCartSync();
      },
      decreaseQty: (variantId) => {
        set((state) => ({
          items: state.items
            .map((item) =>
              item.variantId === variantId ? { ...item, qty: Math.max(0, item.qty - 1) } : item,
            )
            .filter((item) => item.qty > 0),
        }));
        triggerMobileCartSync();
      },
      removeItem: (variantId) => {
        set((state) => ({
          items: state.items.filter((item) => item.variantId !== variantId),
        }));
        triggerMobileCartSync();
      },
      clearCart: () => {
        set({ items: [], couponCode: '', couponDiscount: 0 });
        triggerMobileCartSync(true);
      },
      setCouponCode: (couponCode, couponDiscount) => {
        set({ couponCode, couponDiscount });
        triggerMobileCartSync();
      },
      clearCoupon: () => {
        set({ couponCode: '', couponDiscount: 0 });
        triggerMobileCartSync();
      },
    }),
    {
      name: 'vaniki-cart',
      storage: createJSONStorage(() => asyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state && state.items && state.items.length > 0) {
          triggerMobileCartSync(false);
        }
      },
    },
  ),
);
