/** Auth state: current user, access token, loading. */
import { create } from 'zustand';
import type { User } from '../types/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  clearUser: () => void;
}

export const authStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  loading: true,
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setLoading: (loading) => set({ loading }),
  clearUser: () => set({ user: null, accessToken: null }),
}));
