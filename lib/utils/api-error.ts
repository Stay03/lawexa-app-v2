import { AxiosError } from 'axios';
import type { ApiResponse } from '@/types/api';
import type { CaseViewLimitError } from '@/types/case';
import type { IBlockedReason } from '@/types/message-pack';

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
 * Extract a structured AI-message block reason from an error response.
 *
 * The chat-send endpoint returns the same blocked_reason shape that lives
 * inside `/users/limits` (code, reason, message, plan_remaining, …) under
 * the response's `errors` field when the user is gated server-side.
 */
export function extractBlockedReason(error: unknown): IBlockedReason | null {
  if (!(error instanceof AxiosError) || !error.response?.data) return null;
  const errors = (error.response.data as { errors?: unknown }).errors;
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return null;
  const candidate = errors as Partial<IBlockedReason>;
  if (typeof candidate.reason !== 'string' || typeof candidate.message !== 'string') {
    return null;
  }
  return candidate as IBlockedReason;
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
