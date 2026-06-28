import { z } from 'zod';

/**
 * Edit form for an admin quiz question. Mirrors the PATCH contract: exactly 4
 * non-empty options and a single `correct_index` (0–3).
 */
export const adminQuizQuestionSchema = z.object({
  question_text: z
    .string()
    .min(1, 'Question text is required')
    .max(1000, 'Question is too long'),
  explanation: z.string().max(2000, 'Explanation is too long').optional(),
  difficulty: z.number().int().min(1).max(5),
  topic: z.string().min(1, 'Topic is required').max(255, 'Topic is too long'),
  options: z
    .array(z.string().min(1, 'Option cannot be empty'))
    .length(4, 'Exactly 4 options are required'),
  correct_index: z.number().int().min(0).max(3),
  moderation_notes: z.string().max(2000, 'Note is too long').optional(),
});

export type AdminQuizQuestionFormData = z.infer<typeof adminQuizQuestionSchema>;
