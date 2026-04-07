import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorage } from '../lib/storage';
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
}

interface CartState {
  items: CartItem[];
  couponCode: string;
  couponDiscount: number;
  addItem: (product: Product, variant: ProductVariant) => void;
  increaseQty: (variantId: string) => void;
  decreaseQty: (variantId: string) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  setCoupon: (code: string, discount: number) => void;
  clearCoupon: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      couponCode: '',
      couponDiscount: 0,
      addItem: (product, variant) =>
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
                image: product.images[0]?.url,
                variantId: variant.id,
                variantLabel: variant.label,
                price: variant.price,
                mrp: variant.mrp,
                qty: 1,
              },
            ],
          };
        }),
      increaseQty: (variantId) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.variantId === variantId ? { ...item, qty: item.qty + 1 } : item,
          ),
        })),
      decreaseQty: (variantId) =>
        set((state) => ({
          items: state.items
            .map((item) =>
              item.variantId === variantId ? { ...item, qty: Math.max(0, item.qty - 1) } : item,
            )
            .filter((item) => item.qty > 0),
        })),
      removeItem: (variantId) =>
        set((state) => ({
          items: state.items.filter((item) => item.variantId !== variantId),
        })),
      clearCart: () => set({ items: [], couponCode: '', couponDiscount: 0 }),
      setCoupon: (couponCode, couponDiscount) => set({ couponCode, couponDiscount }),
      clearCoupon: () => set({ couponCode: '', couponDiscount: 0 }),
    }),
    {
      name: 'vaniki-cart',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
