import axios from 'axios';
import { useAuthStore } from '@/lib/stores/authStore';
import { getDeviceId, getCachedFingerprint } from '@/lib/utils/device-id';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor - add auth token and device identifiers
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Attach device identifiers on every request (for retroactive collection)
  const deviceId = getDeviceId();
  const fingerprint = getCachedFingerprint();
  if (deviceId) {
    config.headers['X-Device-Id'] = deviceId;
  }
  if (fingerprint) {
    config.headers['X-Fingerprint'] = fingerprint;
  }

  return config;
});

// Response interceptor - handle errors with smart redirect
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const authState = useAuthStore.getState();

      // Check if we're already on an auth page to prevent redirect loops
      const isAuthPage =
        typeof window !== 'undefined' && (
          window.location.pathname.startsWith('/login') ||
          window.location.pathname.startsWith('/register') ||
          window.location.pathname.startsWith('/forgot-password') ||
          window.location.pathname.startsWith('/reset-password') ||
          window.location.pathname.startsWith('/auth/grant')
        );

      // Check if this is a silent auth check (don't redirect)
      const isSilentCheck = error.config?.headers?.['X-Silent-Auth'];

      // Check if this is a guest-accessible page
      const isGuestPage =
        typeof window !== 'undefined' && (
          window.location.pathname.startsWith('/c/') ||
          window.location.pathname.startsWith('/shared') ||
          // Shared radar scan reports — /radars/{uuid}/scans/{uuid} (not the
          // inbox or /scan-log) are publicly readable when published.
          /\/radars\/[^/]+\/scans\/[^/]+/.test(window.location.pathname)
        );

      // Guest token refresh: re-acquire and retry the original request once
      if (authState.isGuest && !error.config?._retried) {
        try {
          error.config._retried = true;
          // Inline call to avoid circular import with auth.ts
          const refreshResponse = await apiClient.post('/auth/guest', {
            device_id: getDeviceId(),
            fingerprint: getCachedFingerprint(),
          }, {
            headers: { 'X-Silent-Auth': 'true' },
          });
          const refreshData = refreshResponse.data;
          if (refreshData.success && refreshData.data) {
            authState.setAuth(refreshData.data.user, refreshData.data.token);
            error.config.headers.Authorization = `Bearer ${refreshData.data.token}`;
            return apiClient(error.config);
          }
        } catch {
          // Guest token refresh failed — fall through
        }
      }

      // For guest pages, don't redirect to /login — let components handle the error
      if (!isAuthPage && !isSilentCheck && !isGuestPage) {
        authState.clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
