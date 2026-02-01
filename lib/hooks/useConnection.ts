'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { lawyerConnectionApi } from '@/lib/api/lawyerConnection';

interface SendConnectionRequestParams {
  lawyerId: string;
  message?: string;
}

export function useSendConnectionRequest() {
  return useMutation({
    mutationFn: ({ lawyerId, message }: SendConnectionRequestParams) =>
      lawyerConnectionApi.sendConnectionRequest(lawyerId, message),
    onSuccess: (response) => {
      if (response.success && response.data) {
        toast.success(
          `Connection request sent to ${response.data.lawyer.name}!`,
          { duration: 5000 }
        );
      }
    },
    onError: (error: Error & { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      // Try to extract a meaningful error message
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.errors?.lawyer_uuid?.[0] ||
        'Failed to send connection request';

      toast.error(errorMessage);
    },
  });
}

export function useConnectionRequests() {
  return useQuery({
    queryKey: ['connectionRequests'],
    queryFn: () => lawyerConnectionApi.getMyConnectionRequests(),
  });
}
