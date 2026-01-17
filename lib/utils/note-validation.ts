import { z } from 'zod';

/**
 * Schema for form validation (no transforms - simpler for react-hook-form)
 */
export const createNoteSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title cannot exceed 500 characters'),
  content: z
    .string()
    .min(1, 'Content is required'),
  is_private: z.boolean(),
  tags: z.string().optional(),
  price_ngn: z.union([z.string(), z.number()]).optional(),
  price_usd: z.union([z.string(), z.number()]).optional(),
  status: z.enum(['draft', 'published']),
});

/**
 * Schema for updating an existing note
 */
export const updateNoteSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title cannot exceed 500 characters')
    .optional(),
  content: z.string().min(1, 'Content is required').optional(),
  is_private: z.boolean().optional(),
  tags: z.string().optional(),
  price_ngn: z.union([z.string(), z.number()]).optional(),
  price_usd: z.union([z.string(), z.number()]).optional(),
  status: z.enum(['draft', 'published']).optional(),
});

// Form data type (what react-hook-form uses)
export type CreateNoteFormData = z.infer<typeof createNoteSchema>;
export type UpdateNoteFormData = z.infer<typeof updateNoteSchema>;

/**
 * Transform form data for API submission
 */
export function transformNoteFormData(data: CreateNoteFormData) {
  // Parse tags from comma-separated string
  const tags = data.tags
    ? data.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0 && tag.length <= 100)
    : undefined;

  // Parse prices
  const price_ngn = parsePrice(data.price_ngn);
  const price_usd = parsePrice(data.price_usd);

  return {
    title: data.title,
    content: data.content,
    is_private: data.is_private,
    tags: tags && tags.length > 0 ? tags : undefined,
    price_ngn,
    price_usd,
    status: data.status,
  };
}

function parsePrice(val: string | number | undefined): number | undefined {
  if (val === '' || val === undefined) return undefined;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(num) || num <= 0 ? undefined : num;
}
