'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import { extractApiError, type ApiError } from '@/lib/utils/api-error';
import type { LoginFormData, RegisterFormData } from '@/types/auth';

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
    onSuccess: (response) => {
      if (response.success && response.data) {
        setAuth(response.data.user, response.data.token);
        queryClient.invalidateQueries({ queryKey: ['auth'] });

        // Check if user needs onboarding
        const needsOnboarding = !response.data.user.profile?.onboarding_completed;
        router.push(needsOnboarding ? '/onboarding' : '/');
      }
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: (data: RegisterFormData) => authApi.register(data),
    onSuccess: (response) => {
      if (response.success && response.data) {
        setAuth(response.data.user, response.data.token);

        // New users always need onboarding
        const needsOnboarding = !response.data.user.profile?.onboarding_completed;
        router.push(needsOnboarding ? '/onboarding' : '/');
      }
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
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
    user: currentUser?.data || user,
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
