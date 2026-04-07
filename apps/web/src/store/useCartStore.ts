import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId: string) => void;
  updateQty: (productId: string, variantId: string, qty: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
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
      },
      removeItem: (productId, variantId) => {
        set({
          items: get().items.filter(
            (item) => item.productId !== productId || item.variantId !== variantId
          ),
        });
      },
      updateQty: (productId, variantId, qty) => {
        set({
          items: get().items.map((item) =>
            item.productId === productId && item.variantId === variantId
              ? { ...item, qty: Math.max(1, qty) }
              : item
          ),
        });
      },
      clearCart: () => set({ items: [] }),
      getTotalItems: () => get().items.reduce((acc, item) => acc + item.qty, 0),
      getSubtotal: () => get().items.reduce((acc, item) => acc + item.price * item.qty, 0),
    }),
    {
      name: 'vaniki-cart',
    }
  )
);
