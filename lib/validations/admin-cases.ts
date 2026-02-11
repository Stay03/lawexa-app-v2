// Admin Cases - Zod Validation Schemas
// Defines validation rules for all case-related forms

import { z } from 'zod';

/******************************************************************************
                            Case Form Schema
******************************************************************************/

/**
 * Main case form validation schema
 * All fields except title and body are optional
 */
export const caseFormSchema = z.object({
  // Basic Information (Required fields)
  title: z
    .string()
    .min(1, 'Case title is required')
    .max(500, 'Title must be 500 characters or less'),

  body: z.string().min(1, 'Case body is required'),

  // Basic Information (Optional fields)
  course_id: z.number().int().positive().nullable().optional(),

  topic: z
    .string()
    .max(255, 'Topic must be 255 characters or less')
    .nullable()
    .optional(),

  tags: z
    .array(
      z.string().max(100, 'Each tag must be 100 characters or less')
    )
    .optional()
    .default([]),

  level: z
    .string()
    .max(50, 'Level must be 50 characters or less')
    .nullable()
    .optional(),

  // Legal Information
  principles: z.string().nullable().optional(),

  judicial_precedent: z.string().nullable().optional(),

  // Court Information
  country_id: z.number().int().positive().nullable().optional(),

  court_id: z.number().int().positive().nullable().optional(),

  judgment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .nullable()
    .optional(),

  judge_ids: z
    .array(z.number().int().positive())
    .optional()
    .default([]),

  // Relationships
  similar_case_ids: z
    .array(z.number().int().positive())
    .max(50, 'Maximum 50 similar cases allowed')
    .optional()
    .default([]),

  cited_case_ids: z
    .array(z.number().int().positive())
    .max(50, 'Maximum 50 cited cases allowed')
    .optional()
    .default([]),

  // Full Report
  full_report: z.string().nullable().optional(),
});

export type CaseFormValues = z.infer<typeof caseFormSchema>;

/******************************************************************************
                            Quick-Add Schemas
******************************************************************************/

/**
 * Country creation/update validation
 */
export const countryFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Country name is required')
    .max(255, 'Name must be 255 characters or less'),

  code: z
    .string()
    .min(2, 'Country code must be at least 2 characters')
    .max(3, 'Country code must be 3 characters or less')
    .regex(/^[A-Z]+$/, 'Country code must be uppercase letters only')
    .transform((val) => val.toUpperCase()),

  abbreviation: z
    .string()
    .max(10, 'Abbreviation must be 10 characters or less')
    .optional(),

  slug: z
    .string()
    .max(255, 'Slug must be 255 characters or less')
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must contain only lowercase letters, numbers, and hyphens'
    )
    .optional(),
});

export type CountryFormValues = z.infer<typeof countryFormSchema>;

/**
 * Court creation/update validation
 */
export const courtFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Court name is required')
    .max(255, 'Name must be 255 characters or less'),

  country_id: z
    .number({
      required_error: 'Country is required',
      invalid_type_error: 'Country must be selected',
    })
    .int()
    .positive('Country is required'),

  abbreviation: z
    .string()
    .max(20, 'Abbreviation must be 20 characters or less')
    .optional(),

  slug: z
    .string()
    .max(255, 'Slug must be 255 characters or less')
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must contain only lowercase letters, numbers, and hyphens'
    )
    .optional(),
});

export type CourtFormValues = z.infer<typeof courtFormSchema>;

/**
 * Course creation/update validation
 */
export const courseFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Course name is required')
    .max(255, 'Name must be 255 characters or less'),

  slug: z
    .string()
    .max(255, 'Slug must be 255 characters or less')
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must contain only lowercase letters, numbers, and hyphens'
    )
    .optional(),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;

/**
 * Judge creation/update validation
 */
export const judgeFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Judge name is required')
    .max(255, 'Name must be 255 characters or less'),

  slug: z
    .string()
    .max(255, 'Slug must be 255 characters or less')
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must contain only lowercase letters, numbers, and hyphens'
    )
    .optional(),
});

export type JudgeFormValues = z.infer<typeof judgeFormSchema>;

/******************************************************************************
                            Utility Functions
******************************************************************************/

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate court abbreviation from name (extracts initials)
 * Example: "Supreme Court of Nigeria" → "SCN"
 */
export function generateCourtAbbreviation(name: string): string {
  return name
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 20); // Max 20 characters
}

/**
 * Validate file type against accepted types
 */
export function isValidFileType(file: File, acceptedTypes: readonly string[]): boolean {
  return acceptedTypes.includes(file.type);
}

/**
 * Validate file size
 */
export function isValidFileSize(file: File, maxSizeBytes: number): boolean {
  return file.size <= maxSizeBytes;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
}

/**
 * Get file type icon name based on MIME type
 */
export function getFileTypeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'file-text';
  if (
    mimeType === 'application/msword' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
    return 'file-text';
  if (mimeType === 'text/plain') return 'file-text';
  if (mimeType === 'text/rtf') return 'file-text';
  return 'file';
}
