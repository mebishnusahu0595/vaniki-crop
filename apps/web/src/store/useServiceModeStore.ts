import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Address, ServiceMode } from '../types/storefront';

interface ServiceModeState {
  mode: ServiceMode;
  address: Address | null;
  setMode: (mode: ServiceMode) => void;
  setAddress: (address: Address | null) => void;
}

export const useServiceModeStore = create<ServiceModeState>()(
  persist(
    (set) => ({
      mode: 'delivery',
      address: null,
      setMode: (mode) => set({ mode }),
      setAddress: (address) => set({ address }),
    }),
    {
      name: 'vaniki-service-mode',
    }
  )
);
