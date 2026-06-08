import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { secureStorage } from '../lib/storage';

export interface DeliveryStaff {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  referralCode?: string;
}

interface StaffAuthState {
  staff: DeliveryStaff | null;
  token: string | null;
  hydrated: boolean;
  setSession: (payload: { staff: DeliveryStaff; token: string }) => void;
  setStaff: (staff: DeliveryStaff | null) => void;
  logout: () => void;
  setHydrated: (value: boolean) => void;
}

export const useStaffAuthStore = create<StaffAuthState>()(
  persist(
    (set) => ({
      staff: null,
      token: null,
      hydrated: false,
      setSession: ({ staff, token }) => set({ staff, token }),
      setStaff: (staff) => set({ staff }),
      logout: () => set({ staff: null, token: null }),
      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: 'vaniki-staff-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        staff: state.staff,
        token: state.token,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
