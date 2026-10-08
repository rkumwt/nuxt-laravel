import { create } from "zustand";
import { api, type ApiResponse } from "@/lib/api";
import { AUTH_TOKEN } from "@/lib/storageKeys";
import type { AuthUser } from "@/lib/homeRoute";

interface AuthState {
  user: AuthUser | null;
  authToken: string | null;
  // True once the token has been read from localStorage and the user loaded
  ready: boolean;

  updateUser: (user: AuthUser | null) => void;
  updateAuthToken: (token: string | null) => void;
  init: () => Promise<void>;
  logoutAction: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  authToken: null,
  ready: false,

  updateUser: (user) => set({ user }),

  updateAuthToken: (token) => {
    if (token) {
      localStorage.setItem(AUTH_TOKEN, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN);
    }
    set({ authToken: token });
  },

  init: async () => {
    const token = localStorage.getItem(AUTH_TOKEN);
    set({ authToken: token });

    if (token) {
      try {
        const response = await api<ApiResponse<{ user: AuthUser }>>("user");
        set({ user: response.data.user });
      } catch {
        // Stale or invalid token
        get().updateAuthToken(null);
        set({ user: null });
      }
    }

    set({ ready: true });
  },

  logoutAction: async () => {
    if (!get().authToken) return;

    try {
      await api("logout");
    } catch {
      // Log out locally even if the token is already invalid
    }

    localStorage.clear();
    set({ authToken: null, user: null });
  },
}));

export const selectIsLoggedIn = (state: AuthState) => !!state.authToken;
