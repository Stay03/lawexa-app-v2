// Admin Sponsors - Zod Validation Schemas

import { z } from 'zod';

/******************************************************************************
                                  Sponsors
******************************************************************************/

const optionalEmail = z
  .string()
  .trim()
  .max(255)
  .email('Enter a valid email address')
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const optionalShortText = z
  .string()
  .trim()
  .max(255)
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

const optionalLongText = z
  .string()
  .trim()
  .max(5000, 'Notes must be 5000 characters or less')
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

export const sponsorCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Sponsor name is required')
    .max(255, 'Name must be 255 characters or less'),
  contact_email: optionalEmail,
  contact_name: optionalShortText,
  notes: optionalLongText,
  is_active: z.boolean().optional(),
});

export type SponsorCreateValues = z.infer<typeof sponsorCreateSchema>;

export const sponsorUpdateSchema = sponsorCreateSchema.partial();

export type SponsorUpdateValues = z.infer<typeof sponsorUpdateSchema>;

/******************************************************************************
                                  Campaigns
******************************************************************************/

const sharedCampaignFields = {
  name: z
    .string()
    .trim()
    .min(1, 'Campaign name is required')
    .max(255, 'Name must be 255 characters or less'),
  max_grants: z
    .number()
    .int()
    .positive('Max grants must be a positive number')
    .nullable()
    .optional(),
  notes: optionalLongText,
};

// Plan campaign — reuse an existing public plan, time-limited subscription
export const campaignCreatePlanSchema = z.object({
  type: z.literal('plan'),
  plan_id: z
    .number({ message: 'Select a plan' })
    .int()
    .positive('Select a plan'),
  duration_days: z
    .number({ message: 'Enter a duration' })
    .int('Duration must be a whole number')
    .min(1, 'Duration must be at least 1 day')
    .max(3650, 'Duration must be 3650 days or less'),
  ...sharedCampaignFields,
});

// Pack campaign — bundle of AI messages per student, no time limit
export const campaignCreatePackSchema = z.object({
  type: z.literal('pack'),
  pack_size: z
    .number({ message: 'Enter a pack size' })
    .int('Pack size must be a whole number')
    .min(1, 'Pack size must be at least 1')
    .max(100_000, 'Pack size must be 100,000 or less'),
  ...sharedCampaignFields,
});

export const campaignCreateSchema = z.discriminatedUnion('type', [
  campaignCreatePlanSchema,
  campaignCreatePackSchema,
]);

export type CampaignCreateValues = z.infer<typeof campaignCreateSchema>;

// PATCH only allows name, notes, max_grants — anything else is 422 from backend
export const campaignUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Campaign name is required')
    .max(255)
    .optional(),
  notes: optionalLongText,
  max_grants: z
    .number()
    .int()
    .positive('Max grants must be a positive number')
    .nullable()
    .optional(),
});

export type CampaignUpdateValues = z.infer<typeof campaignUpdateSchema>;

/******************************************************************************
                                   Grants
******************************************************************************/

export const BULK_GRANT_MAX_EMAILS = 500;

/**
 * Parse a free-form textarea into a deduped, lowercased email list.
 * Splits on whitespace, commas, semicolons, newlines.
 */
export function parseEmailsText(raw: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(/[\s,;]+/)) {
    const email = piece.trim().toLowerCase();
    if (!email) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export const BULK_GRANT_MAX_USER_IDS = 500;

export const bulkGrantSchema = z
  .object({
    emails: z
      .array(z.string().email('Invalid email'))
      .max(
        BULK_GRANT_MAX_EMAILS,
        `Maximum ${BULK_GRANT_MAX_EMAILS} emails per request`
      )
      .optional(),
    user_ids: z
      .array(z.number().int().positive())
      .max(
        BULK_GRANT_MAX_USER_IDS,
        `Maximum ${BULK_GRANT_MAX_USER_IDS} users per request`
      )
      .optional(),
  })
  .refine(
    (v) => (v.emails?.length ?? 0) + (v.user_ids?.length ?? 0) > 0,
    { message: 'Select at least one user or paste at least one email' }
  );

export type BulkGrantValues = z.infer<typeof bulkGrantSchema>;
