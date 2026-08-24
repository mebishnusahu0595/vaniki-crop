import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Simple async storage (no expo-secure-store dependency version)
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DealerUser {
  id: string;
  name: string;
  mobile: string;
  role: 'storeAdmin' | 'superAdmin';
  email?: string;
  storeName?: string;
  storeId?: string;
  expoPushToken?: string;
  savedAddress?: any;
  [key: string]: any;
}

interface AuthState {
  user: DealerUser | null;
  token: string | null;
  hydrated: boolean;
  setSession: (payload: { user: DealerUser; token: string }) => void;
  setUser: (user: DealerUser | null) => void;
  logout: () => void;
  setHydrated: (value: boolean) => void;
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
    }),
    {
      name: 'vaniki-dealer-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
        } else {
          useAuthStore.getState().setHydrated(true);
        }
      },
    },
  ),
);
