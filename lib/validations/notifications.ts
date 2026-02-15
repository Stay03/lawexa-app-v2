import { z } from 'zod';

/**
 * Zod schema for admin broadcast notification form
 * Matches backend validation rules from notification-api.md
 */
export const broadcastNotificationSchema = z.object({
  title: z
    .string()
    .min(1, 'Please provide a notification title.')
    .max(255, 'Notification title cannot exceed 255 characters.'),
  message: z
    .string()
    .min(1, 'Please provide a notification message.')
    .max(2000, 'Notification message cannot exceed 2000 characters.'),
  action_url: z
    .string()
    .url('Action URL must be a valid URL.')
    .max(500, 'Action URL cannot exceed 500 characters.')
    .optional()
    .or(z.literal('')),
  icon: z
    .string()
    .max(50, 'Icon cannot exceed 50 characters.')
    .optional()
    .or(z.literal('')),
  targeting: z.enum(['all', 'role', 'user_ids'], {
    message: 'Please select a targeting option.',
  }),
  role: z
    .enum(['user', 'researcher', 'admin', 'superadmin'])
    .optional(),
  user_ids: z
    .string()
    .optional(),
}).refine(
  (data) => {
    if (data.targeting === 'role') return !!data.role;
    return true;
  },
  { message: 'Please select a role.', path: ['role'] }
).refine(
  (data) => {
    if (data.targeting === 'user_ids') {
      return !!data.user_ids && data.user_ids.trim().length > 0;
    }
    return true;
  },
  { message: 'Please provide at least one user ID.', path: ['user_ids'] }
);

export type BroadcastNotificationFormValues = z.infer<typeof broadcastNotificationSchema>;
