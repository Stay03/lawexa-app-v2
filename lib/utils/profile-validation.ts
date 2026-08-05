import { z } from 'zod';

const optionalString = z.string().optional().or(z.literal(''));

const optionalUrl = z
  .string()
  .url('Enter a valid URL')
  .optional()
  .or(z.literal(''));

// The handle's shape, mirrored from the backend (2026-08-05): 3–30 characters,
// lowercase letters, numbers and underscores, first character a letter or
// number. Checked here so an obvious mistake costs no round trip; the server
// stays the only authority on reserved and already-taken handles.
const USERNAME_ALLOWED = /^[a-z0-9_]+$/;
const USERNAME_START = /^[a-z0-9]/;

export const profileFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  // Empty means "no handle yet", which is a state the account can stay in —
  // a handle can be chosen but never cleared, so the field submits nothing.
  username: optionalString.superRefine((value, ctx) => {
    if (!value) return;
    if (value.length < 3) {
      ctx.addIssue('Username must be at least 3 characters');
      return;
    }
    if (value.length > 30) {
      ctx.addIssue('Username must be 30 characters or less');
      return;
    }
    if (!USERNAME_ALLOWED.test(value)) {
      ctx.addIssue('Use lowercase letters, numbers and underscores only');
      return;
    }
    if (!USERNAME_START.test(value)) {
      ctx.addIssue('Username must start with a letter or number');
    }
  }),
  bio: z.string().max(500, 'Bio must be 500 characters or less').optional().or(z.literal('')),
  gender: optionalString,
  date_of_birth: optionalString.refine(
    (val) => {
      if (!val) return true;
      const date = new Date(val);
      return !isNaN(date.getTime()) && date < new Date();
    },
    { message: 'Date of birth must be in the past' }
  ),
  user_type: z.enum(['lawyer', 'law_student', 'other']).optional(),
  student_education_level: z.enum(['university', 'law_school']).nullable().optional(),
  profession: optionalString,
  country: optionalString,
  state: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(255).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  areas_of_expertise: z.array(z.number()),
  university: optionalString,
  level: optionalString,
  law_school: optionalString,
  call_to_bar_year: optionalString.refine(
    (val) => {
      if (!val) return true;
      const year = parseInt(val, 10);
      return !isNaN(year) && year >= 1900 && year <= new Date().getFullYear();
    },
    { message: 'Enter a valid year between 1900 and now' }
  ),
  call_number: optionalString,
  other_certifications: optionalString,
  work_experience: optionalString,
  linkedin_url: optionalUrl,
  website_url: optionalUrl,
  twitter_url: optionalUrl,
  facebook_url: optionalUrl,
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
