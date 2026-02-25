import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lawyerVerificationApi } from '@/lib/api/lawyerVerification';

// ========== Query Key Factory ==========

export const lawyerVerificationKeys = {
  all: ['lawyer-verification'] as const,
  profile: () => [...lawyerVerificationKeys.all, 'my-profile'] as const,
};

// ========== Query Hooks ==========

/**
 * Fetch the authenticated lawyer's verification profile.
 */
export function useLawyerProfile(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: lawyerVerificationKeys.profile(),
    queryFn: () => lawyerVerificationApi.getMyProfile(),
    staleTime: 60_000,
    enabled: options?.enabled !== false,
  });
}

// ========== Mutation Hooks ==========

/**
 * Upload a verification document.
 * Invalidates the profile query on success so documents list refreshes.
 */
export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => lawyerVerificationApi.uploadDocument(file),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: lawyerVerificationKeys.profile(),
      });
    },
  });
}

/**
 * Delete a verification document.
 * Invalidates the profile query on success.
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fileId: number) => lawyerVerificationApi.deleteDocument(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: lawyerVerificationKeys.profile(),
      });
    },
  });
}

/**
 * Submit (or resubmit) the profile for verification.
 * Invalidates profile on success so status updates.
 */
export function useSubmitVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => lawyerVerificationApi.submitForVerification(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: lawyerVerificationKeys.profile(),
      });
    },
  });
}
