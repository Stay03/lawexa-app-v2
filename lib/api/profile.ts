import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/auth';
import type { ProfileUpdatePayload } from '@/types/profile';

export const profileApi = {
  getProfile: async () => {
    const response = await apiClient.get<ApiResponse<User>>('/profile');
    return response.data;
  },

  updateProfile: async (data: ProfileUpdatePayload) => {
    const response = await apiClient.put<ApiResponse<User>>('/profile', data);
    return response.data;
  },

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await apiClient.post<ApiResponse<{ avatar_url: string }>>(
      '/avatar',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  deleteAvatar: async () => {
    const response = await apiClient.delete<ApiResponse<null>>('/avatar');
    return response.data;
  },
};
