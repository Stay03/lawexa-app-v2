import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/auth';

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  onboardingComplete: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  setOnboardingComplete: (value: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isGuest: false,
      onboardingComplete: false,

      // Let Zustand persist handle storage - no manual localStorage
      setAuth: (user, token) => {
        // If the user already has a profession, they completed onboarding before
        const hasCompletedOnboarding = !!(user.profile?.profession);
        set({
          user,
          token,
          isAuthenticated: true,
          isGuest: user.role === 'guest',
          onboardingComplete: hasCompletedOnboarding,
        });
      },

      clearAuth: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isGuest: false,
          onboardingComplete: false,
        });
      },

      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },

      setOnboardingComplete: (value) => {
        set({ onboardingComplete: value });
      },
    }),
    {
      name: 'lawexa-auth',
    }
  )
);
