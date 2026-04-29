import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { secureStorage } from '../lib/storage';
import type { AuthUser } from '../types/storefront';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  setSession: (payload: { user: AuthUser; token: string }) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  setHydrated: (value: boolean) => void;
  showCheckInModal: boolean;
  setShowCheckInModal: (show: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      hydrated: false,
      setSession: ({ user, token }) => set({ user, token }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, token: null }),
      setHydrated: (value) => set({ hydrated: value }),
      showCheckInModal: false,
      setShowCheckInModal: (show) => set({ showCheckInModal: show }),
    }),
    {
      name: 'vaniki-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
