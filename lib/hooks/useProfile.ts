'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { profileApi } from '@/lib/api/profile';
import { useAuthStore } from '@/lib/stores/authStore';
import type { ProfileUpdatePayload } from '@/types/profile';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { updateUser } = useAuthStore();

  return useMutation({
    mutationFn: (data: ProfileUpdatePayload) => profileApi.updateProfile(data),
    onSuccess: (response) => {
      if (response.success && response.data) {
        updateUser({
          name: response.data.name,
          profile: response.data.profile,
          areas_of_expertise: response.data.areas_of_expertise,
        });
        queryClient.invalidateQueries({ queryKey: ['auth'] });
        toast.success('Profile updated successfully');
      }
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const message = error.response?.data?.message || 'Failed to update profile';
      toast.error(message);
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const { updateUser } = useAuthStore();

  return useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(file),
    onSuccess: (response) => {
      if (response.success && response.data) {
        updateUser({ avatar_url: response.data.avatar_url });
        queryClient.invalidateQueries({ queryKey: ['auth'] });
        toast.success('Avatar uploaded successfully');
      }
    },
    onError: () => {
      toast.error('Failed to upload avatar. Please try again.');
    },
  });
}

export function useDeleteAvatar() {
  const queryClient = useQueryClient();
  const { updateUser } = useAuthStore();

  return useMutation({
    mutationFn: () => profileApi.deleteAvatar(),
    onSuccess: () => {
      updateUser({ avatar_url: null });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast.success('Avatar removed');
    },
    onError: () => {
      toast.error('Failed to remove avatar');
    },
  });
}
