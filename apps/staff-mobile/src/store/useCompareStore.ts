import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorage } from '../lib/storage';
import type { Product } from '../types/storefront';

interface CompareState {
  products: Product[];
  toggleProduct: (product: Product) => { added: boolean; message: string };
  clearAll: () => void;
  isCompared: (productId: string) => boolean;
}

const MAX_COMPARE_PRODUCTS = 3;

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      products: [],
      toggleProduct: (product) => {
        const exists = get().products.some((item) => item.id === product.id);
        if (exists) {
          set((state) => ({
            products: state.products.filter((item) => item.id !== product.id),
          }));
          return { added: false, message: `${product.name} removed from compare` };
        }

        if (get().products.length >= MAX_COMPARE_PRODUCTS) {
          return { added: false, message: 'You can compare up to 3 products only' };
        }

        set((state) => ({ products: [...state.products, product] }));
        return { added: true, message: `${product.name} added to compare` };
      },
      clearAll: () => set({ products: [] }),
      isCompared: (productId) => get().products.some((item) => item.id === productId),
    }),
    {
      name: 'vaniki-mobile-compare',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ products: state.products }),
    },
  ),
);
