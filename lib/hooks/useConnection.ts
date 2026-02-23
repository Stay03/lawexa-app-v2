'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { lawyerConnectionApi } from '@/lib/api/lawyerConnection';

interface SendConnectionRequestParams {
  lawyerId: string;
  phone_number?: string;
  contact_email?: string;
  message?: string;
}

export function useSendConnectionRequest() {
  return useMutation({
    mutationFn: (params: SendConnectionRequestParams) =>
      lawyerConnectionApi.sendConnectionRequest(params),
    onSuccess: (response) => {
      if (response.success && response.data) {
        toast.success(
          `Connection request sent to ${response.data.lawyer.name}!`,
          { duration: 5000 }
        );
      }
    },
  });
}

export function useConnectionRequests() {
  return useQuery({
    queryKey: ['connectionRequests'],
    queryFn: () => lawyerConnectionApi.getMyConnectionRequests(),
  });
}
