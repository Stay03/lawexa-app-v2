import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { AuthResponse, User, Session, UserProfile } from '@/types/auth';

export const authApi = {
  // Public endpoints
  register: async (data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/register',
      data
    );
    return response.data;
  },

  login: async (data: { email: string; password: string }) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/login',
      data
    );
    return response.data;
  },

  googleAuthUrl: async () => {
    const response = await apiClient.get<ApiResponse<{ url: string }>>(
      '/auth/google'
    );
    return response.data;
  },

  googleCallback: async (code: string) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/google',
      { code }
    );
    return response.data;
  },

  guestToken: async (fingerprint?: string) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/guest',
      { fingerprint }
    );
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/forgot-password',
      { email }
    );
    return response.data;
  },

  resetPassword: async (data: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) => {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/reset-password',
      data
    );
    return response.data;
  },

  // Protected endpoints
  me: async () => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data;
  },

  // Silent auth check (won't trigger redirect on 401)
  meSilent: async () => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me', {
      headers: { 'X-Silent-Auth': 'true' },
    });
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post<ApiResponse<null>>('/auth/logout');
    return response.data;
  },

  resendVerification: async () => {
    const response = await apiClient.post<ApiResponse<null>>(
      '/auth/resend-verification'
    );
    return response.data;
  },

  getSessions: async () => {
    const response = await apiClient.get<ApiResponse<Session[]>>(
      '/auth/sessions'
    );
    return response.data;
  },

  revokeSession: async (sessionId: number) => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/auth/sessions/${sessionId}`
    );
    return response.data;
  },

  revokeAllSessions: async () => {
    const response = await apiClient.delete<ApiResponse<null>>('/auth/sessions');
    return response.data;
  },

  updateProfile: async (data: Partial<UserProfile>) => {
    const response = await apiClient.patch<ApiResponse<User>>(
      '/auth/profile',
      data
    );
    return response.data;
  },
};
