import { AxiosError } from 'axios';
import type { ApiResponse } from '@/types/api';

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
 * Get the first error message for a specific field.
 */
export function getFieldError(
  errors: Record<string, string[]> | null | undefined,
  field: string
): string | undefined {
  return errors?.[field]?.[0];
}
