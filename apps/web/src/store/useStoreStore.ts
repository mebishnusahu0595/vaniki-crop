import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Store } from '../types/storefront';

interface StoreState {
  selectedStore: Store | null;
  setStore: (store: Store | null) => void;
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set) => ({
      selectedStore: null,
      setStore: (selectedStore) => set({ selectedStore }),
    }),
    {
      name: 'vaniki-selected-store',
    }
  )
);
