import axios from 'axios';
import { useAuthStore } from '@/lib/stores/authStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor - add auth token from Zustand store
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors with smart redirect
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if we're already on an auth page to prevent redirect loops
      const isAuthPage =
        typeof window !== 'undefined' && (
          window.location.pathname.startsWith('/login') ||
          window.location.pathname.startsWith('/register') ||
          window.location.pathname.startsWith('/forgot-password') ||
          window.location.pathname.startsWith('/reset-password')
        );

      // Check if this is a silent auth check (don't redirect)
      const isSilentCheck = error.config?.headers?.['X-Silent-Auth'];

      if (!isAuthPage && !isSilentCheck) {
        useAuthStore.getState().clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
