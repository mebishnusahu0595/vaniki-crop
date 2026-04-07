import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '../types/admin';

interface AdminAuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setSession: (user: AuthUser, token: string) => void;
  setUser: (user: AuthUser | null) => void;
  clearSession: () => void;
  setHydrated: (value: boolean) => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hydrated: false,
      setSession: (user, token) => set({ user, token }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ user: null, token: null }),
      setHydrated: (value) => set({ hydrated: value }),
    }),
    {
      name: 'vaniki-super-admin-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
