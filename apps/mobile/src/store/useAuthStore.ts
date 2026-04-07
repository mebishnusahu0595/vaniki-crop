import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorage } from '../lib/storage';
import type { AuthUser } from '../types/storefront';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  hydrated: boolean;
  biometricsEnabled: boolean;
  setSession: (payload: { user: AuthUser; token: string }) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  setHydrated: (value: boolean) => void;
  enableBiometrics: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      hydrated: false,
      biometricsEnabled: false,
      setSession: ({ user, token }) => set({ user, token }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, token: null, biometricsEnabled: false }),
      setHydrated: (value) => set({ hydrated: value }),
      enableBiometrics: async () => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const canEnroll = await LocalAuthentication.isEnrolledAsync();
        const enabled = hasHardware && canEnroll;
        set({ biometricsEnabled: enabled });
        return enabled;
      },
    }),
    {
      name: 'vaniki-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        biometricsEnabled: state.biometricsEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
