'use client';

import { useMutation } from '@tanstack/react-query';
import { feedbackApi } from '@/lib/api/feedback';
import type { SubmitFeedbackData } from '@/types/feedback';

// Query keys factory
export const feedbackKeys = {
  all: ['feedback'] as const,
};

/**
 * Hook for submitting feedback
 */
export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (data: SubmitFeedbackData) => feedbackApi.submit(data),
  });
}
