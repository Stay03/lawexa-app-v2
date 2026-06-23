'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import { useConfidentialModeStore } from '@/lib/stores/confidentialModeStore';
import { clearAllTranscripts } from '@/lib/storage/confidentialTranscriptStore';
import { extractApiError, type ApiError } from '@/lib/utils/api-error';
import { clearAttribution } from '@/lib/utils/attribution';
import type { LoginFormData, RegisterFormData } from '@/types/auth';

// Honor a ?redirect= return URL (safe internal paths only) set by pages that
// gate on auth — e.g. the /ambassadors landing. Falls back to the home page.
function getSafeRedirect(): string {
  if (typeof window === 'undefined') return '/';
  const target = new URLSearchParams(window.location.search).get('redirect');
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/';
}

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isGuest, setAuth, clearAuth } = useAuthStore();

  // Get current user query
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    enabled: isAuthenticated && !isGuest,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (data: LoginFormData) => authApi.login(data),
    onSuccess: (response, variables) => {
      if (response.success && response.data) {
        setAuth(response.data.user, response.data.token);
        queryClient.invalidateQueries({ queryKey: ['auth'] });

        // For unverified email users, redirect to check-email page
        if (response.data.user.auth_provider === 'email' && !response.data.user.is_verified) {
          router.push(`/check-email?email=${encodeURIComponent(variables.email)}`);
          return;
        }

        // Check if user needs onboarding (profession is set after completing onboarding)
        const needsOnboarding = !(response.data.user.profile?.onboarding_completed_at || response.data.user.profile?.profession);
        router.push(needsOnboarding ? '/onboarding' : getSafeRedirect());
      }
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: (data: RegisterFormData) => authApi.register(data),
    onSuccess: (response, variables) => {
      if (response.success && response.data) {
        setAuth(response.data.user, response.data.token);
        clearAttribution();

        // For email signups, redirect to check-email page to verify
        if (response.data.user.auth_provider === 'email' && !response.data.user.is_verified) {
          router.push(`/check-email?email=${encodeURIComponent(variables.email)}`);
          return;
        }

        // For OAuth users or verified users, continue to onboarding
        const needsOnboarding = !(response.data.user.profile?.onboarding_completed_at || response.data.user.profile?.profession);
        router.push(needsOnboarding ? '/onboarding' : getSafeRedirect());
      }
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: async () => {
      // Wipe confidential transcripts and reset session state — confidential
      // chats are device-only and must not survive a logout.
      try {
        await clearAllTranscripts();
      } catch {
        // Non-fatal — IDB unavailable on server / private mode.
      }
      useConfidentialModeStore.getState().reset();
      clearAuth();
      queryClient.clear();
      router.push('/login');
    },
  });

  // Google auth
  const googleAuthMutation = useMutation({
    mutationFn: () => authApi.googleAuthUrl(),
    onSuccess: (response) => {
      if (response.success && response.data) {
        window.location.href = response.data.url;
      }
    },
  });

  // Extract errors with proper typing
  const loginError: ApiError | null = loginMutation.error
    ? extractApiError(loginMutation.error)
    : null;

  const registerError: ApiError | null = registerMutation.error
    ? extractApiError(registerMutation.error)
    : null;

  return {
    user: currentUser?.data?.user || user,
    isAuthenticated,
    isGuest,
    isLoading,
    login: loginMutation.mutate,
    loginError,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutate,
    registerError,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    googleAuth: googleAuthMutation.mutate,
    isGoogleAuthPending: googleAuthMutation.isPending,
  };
}
