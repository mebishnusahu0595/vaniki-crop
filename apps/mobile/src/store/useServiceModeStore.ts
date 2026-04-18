import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorage } from '../lib/storage';
import type { Address, ServiceMode } from '../types/storefront';

interface ServiceModeState {
  mode: ServiceMode;
  address: Address | null;
  selectorOpen: boolean;
  barExpanded: boolean;
  setMode: (mode: ServiceMode) => void;
  setAddress: (address: Address | null) => void;
  openSelector: () => void;
  closeSelector: () => void;
  setBarExpanded: (expanded: boolean) => void;
}

export const useServiceModeStore = create<ServiceModeState>()(
  persist(
    (set) => ({
      mode: 'delivery',
      address: null,
      selectorOpen: false,
      barExpanded: true,
      setMode: (mode) => set({ mode }),
      setAddress: (address) => set({ address }),
      openSelector: () => set({ selectorOpen: true }),
      closeSelector: () => set({ selectorOpen: false }),
      setBarExpanded: (expanded) => set({ barExpanded: expanded }),
    }),
    {
      name: 'vaniki-service-mode',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ mode: state.mode, address: state.address, barExpanded: state.barExpanded }),
    },
  ),
);
