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

const CUSTOM_PERIODS = ['day', 'month', 'billing_interval', 'lifetime'] as const;

const sharedCampaignFields = {
  name: z
    .string()
    .trim()
    .min(1, 'Campaign name is required')
    .max(255, 'Name must be 255 characters or less'),
  duration_days: z
    .number({ message: 'Enter a duration' })
    .int('Duration must be a whole number')
    .min(1, 'Duration must be at least 1 day')
    .max(3650, 'Duration must be 3650 days or less'),
  max_grants: z
    .number()
    .int()
    .positive('Max grants must be a positive number')
    .nullable()
    .optional(),
  notes: optionalLongText,
};

// Branch A — reuse an existing plan
export const campaignCreateExistingPlanSchema = z.object({
  plan_source: z.literal('existing'),
  plan_id: z
    .number({ message: 'Select a plan' })
    .int()
    .positive('Select a plan'),
  ...sharedCampaignFields,
});

// Branch B — auto-create an internal plan with custom quota
export const campaignCreateCustomPlanSchema = z.object({
  plan_source: z.literal('custom'),
  custom_messages: z
    .number({ message: 'Enter a message count' })
    .int('Message count must be a whole number')
    .refine((v) => v === -1 || v > 0, {
      message: 'Use -1 for unlimited, otherwise a positive number',
    }),
  custom_period: z.enum(CUSTOM_PERIODS, {
    message: 'Select a billing period',
  }),
  ...sharedCampaignFields,
});

export const campaignCreateSchema = z.discriminatedUnion('plan_source', [
  campaignCreateExistingPlanSchema,
  campaignCreateCustomPlanSchema,
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

export const bulkGrantSchema = z.object({
  emails: z
    .array(z.string().email('Invalid email'))
    .min(1, 'Add at least one email')
    .max(
      BULK_GRANT_MAX_EMAILS,
      `Maximum ${BULK_GRANT_MAX_EMAILS} emails per request`
    ),
});

export type BulkGrantValues = z.infer<typeof bulkGrantSchema>;
