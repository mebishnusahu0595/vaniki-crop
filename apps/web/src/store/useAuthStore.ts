import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '../types/storefront';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      updateUser: (updatedUser) => 
        set((state) => ({ 
          user: state.user ? { ...state.user, ...updatedUser } : null 
        })),
    }),
    {
      name: 'vaniki-auth',
    }
  )
);
