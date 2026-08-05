import type { UserType } from './auth';

export interface ProfileUpdatePayload {
  name?: string;
  /**
   * The account's `@handle`. 3–30 characters, lowercase letters, numbers and
   * underscores, starting with a letter or number. Reserved words and taken
   * handles come back 422 with the reason in `errors.username`; sending the
   * account's own current handle is a no-op, not a conflict (all three
   * measured against production, 2026-08-05).
   */
  username?: string;
  user_type?: UserType;
  profession?: string;
  country?: string;
  address?: string;
  city?: string;
  state?: string;
  bio?: string;
  gender?: string;
  date_of_birth?: string;
  law_school?: string;
  university?: string;
  level?: string;
  call_to_bar_year?: number;
  call_number?: string;
  other_certifications?: string;
  work_experience?: string;
  linkedin_url?: string;
  website_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  areas_of_expertise?: number[];
}
