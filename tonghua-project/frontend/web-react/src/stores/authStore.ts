import { create } from 'zustand';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: (user, _accessToken, _refreshToken) => {
    // Tokens are managed by httpOnly cookies set by the server.
    // Do NOT store tokens in client-side state or localStorage.
    set({
      user,
      isAuthenticated: true,
    });
  },

  logout: () => {
    // Server will clear httpOnly cookies on /auth/logout
    set({
      user: null,
      isAuthenticated: false,
    });
  },

  updateUser: (userData) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...userData } : null,
    })),

  setLoading: (isLoading) => set({ isLoading }),
}));
