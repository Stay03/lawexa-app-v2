import { AxiosError } from 'axios';
import type { ApiResponse } from '@/types/api';
import type { CaseViewLimitError } from '@/types/case';

export interface ApiError {
  message: string;
  errors: Record<string, string[]> | null;
  status: number;
}

/**
 * Extract structured error information from API responses.
 */
export function extractApiError(error: unknown): ApiError {
  if (error instanceof AxiosError && error.response?.data) {
    const data = error.response.data as ApiResponse<unknown>;
    return {
      message: data.message || 'An error occurred',
      errors: data.errors || null,
      status: error.response.status,
    };
  }
  return {
    message: 'Network error. Please try again.',
    errors: null,
    status: 0,
  };
}

/**
 * Extract structured view-limit error from a 429 response.
 */
export function extractViewLimitError(error: unknown): CaseViewLimitError | null {
  if (error instanceof AxiosError && error.response?.status === 429) {
    const errors = error.response.data?.errors;
    if (errors?.limit_type) {
      return {
        limit_type: errors.limit_type,
        plan_limit: errors.plan_limit,
        hard_limit: errors.hard_limit,
        used: errors.used,
        remaining: errors.remaining,
        resets_at: errors.resets_at,
      };
    }
  }
  return null;
}

/**
 * Get the first error message for a specific field.
 */
export function getFieldError(
  errors: Record<string, string[]> | null | undefined,
  field: string
): string | undefined {
  return errors?.[field]?.[0];
}
