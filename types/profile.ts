import type { UserType } from './auth';

export interface ProfileUpdatePayload {
  name?: string;
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
