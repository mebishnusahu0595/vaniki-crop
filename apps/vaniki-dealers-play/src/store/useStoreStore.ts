import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorage } from '../lib/storage';
import type { Store } from '../types/storefront';

interface StoreState {
  selectedStore: Store | null;
  setStore: (store: Store | null) => void;
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set) => ({
      selectedStore: null,
      setStore: (store) => set({ selectedStore: store }),
    }),
    {
      name: 'vaniki-store',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
