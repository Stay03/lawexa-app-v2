import { z } from 'zod';

/******************************************************************************
                            Approve Verification Schema
******************************************************************************/

/**
 * Validation schema for approving a lawyer verification.
 * Notes are optional.
 */
export const approveVerificationSchema = z.object({
  verification_notes: z
    .string()
    .max(2000, 'Notes must be 2000 characters or less')
    .optional()
    .or(z.literal('')),
});

export type ApproveVerificationFormValues = z.infer<typeof approveVerificationSchema>;

/******************************************************************************
                            Reject Verification Schema
******************************************************************************/

/**
 * Validation schema for rejecting a lawyer verification.
 * A rejection reason is required (max 1000 characters per API).
 */
export const rejectVerificationSchema = z.object({
  rejection_reason: z
    .string()
    .min(1, 'Please provide a reason for rejection')
    .max(1000, 'Rejection reason must be 1000 characters or less'),
});

export type RejectVerificationFormValues = z.infer<typeof rejectVerificationSchema>;
