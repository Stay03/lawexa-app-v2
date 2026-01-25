import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/auth';

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isGuest: false,

      // Let Zustand persist handle storage - no manual localStorage
      setAuth: (user, token) => {
        set({
          user,
          token,
          isAuthenticated: true,
          isGuest: user.role === 'guest',
        });
      },

      clearAuth: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isGuest: false,
        });
      },

      updateUser: (userData) => {
        const currentUser = get().user;
        console.log('[authStore] updateUser called', {
          currentUser,
          userData,
        });
        if (currentUser) {
          const newUser = { ...currentUser, ...userData };
          console.log('[authStore] Setting new user:', newUser);
          set({ user: newUser });
        } else {
          console.log('[authStore] No current user, skipping update');
        }
      },
    }),
    {
      name: 'lawexa-auth',
    }
  )
);
