import { z } from 'zod';

const optionalString = z.string().optional().or(z.literal(''));

const optionalUrl = z
  .string()
  .url('Enter a valid URL')
  .optional()
  .or(z.literal(''));

export const profileFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
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
