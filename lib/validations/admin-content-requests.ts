// Admin Content Requests - Zod Validation Schemas
// Defines validation rules for admin content request operations

import { z } from 'zod';

/******************************************************************************
                            Update Status Schema
******************************************************************************/

/**
 * Validation schema for updating content request status
 */
export const updateStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'fulfilled', 'rejected']),
});

export type UpdateStatusFormValues = z.infer<typeof updateStatusSchema>;

/******************************************************************************
                            Fulfill Request Schema
******************************************************************************/

/**
 * Validation schema for fulfilling content request with linked content
 */
export const fulfillSchema = z.object({
  created_content_type: z.enum(['case', 'note', 'statute', 'provision']),
  created_content_id: z
    .number()
    .int('Content ID must be an integer')
    .positive('Content ID must be a positive number'),
});

export type FulfillFormValues = z.infer<typeof fulfillSchema>;

/******************************************************************************
                            Reject Request Schema
******************************************************************************/

/**
 * Validation schema for rejecting content request with reason
 */
export const rejectSchema = z.object({
  rejection_reason: z
    .string()
    .min(1, 'Please provide a reason for rejection')
    .max(2000, 'Rejection reason must be 2000 characters or less'),
});

export type RejectFormValues = z.infer<typeof rejectSchema>;
