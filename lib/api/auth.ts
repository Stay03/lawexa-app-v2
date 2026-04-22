import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { AuthResponse, User, Session, UserProfile } from '@/types/auth';
import { getDeviceIdentifiers } from '@/lib/utils/device-id';
import { getStoredAttribution } from '@/lib/utils/attribution';

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
      { ...data, ...getStoredAttribution(), ...getDeviceIdentifiers() }
    );
    return response.data;
  },

  login: async (data: { email: string; password: string }) => {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/login',
      { ...data, ...getDeviceIdentifiers() }
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
      { code, ...getStoredAttribution(), ...getDeviceIdentifiers() }
    );
    return response.data;
  },

  guestToken: async (fingerprint?: string) => {
    const identifiers = getDeviceIdentifiers();
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/guest',
      {
        ...getStoredAttribution(),
        fingerprint: fingerprint ?? identifiers.fingerprint,
        device_id: identifiers.device_id,
      }
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

  // SSO grant token for third-party apps (e.g., Bench)
  grantToken: async (clientId: string) => {
    const response = await apiClient.post<ApiResponse<{ token: string; user: User }>>(
      '/auth/grant-token',
      { client_id: clientId }
    );
    return response.data;
  },

  // Protected endpoints
  me: async () => {
    const response = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me');
    return response.data;
  },

  // Silent auth check (won't trigger redirect on 401)
  meSilent: async () => {
    const response = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me', {
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
    const response = await apiClient.put<ApiResponse<User>>(
      '/profile',
      data
    );
    return response.data;
  },
};
