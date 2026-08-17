import {
  AtSign,
  Award,
  Briefcase,
  Building,
  CalendarDays,
  Facebook,
  House,
  IdCard,
  Landmark,
  Link2,
  Linkedin,
  MapPin,
  NotebookPen,
  School,
  Twitter,
  UserPen,
  type LucideIcon,
} from 'lucide-react';

import { PROFILE_LIMITS, normaliseUsername } from './form-model';
import type { ProfileFormValues } from './form-model';

/**
 * profile/text-fields: how each TYPED field of the profile is presented, stated
 * once for the two places that present it.
 *
 * ── WHY A TABLE AND NOT TWENTY BLOCKS OF JSX ───────────────────────────────
 * Every typed field is now shown twice: as a row on the list (its icon, its
 * label, the value it holds) and inside the panel that edits it (the same
 * label, a control, a placeholder, a limit, a keyboard). Written inline that
 * would be two copies of sixteen fields, free to drift the first time a label
 * is reworded. So the presentation of a field is a value, the row reads it, and
 * the panel reads the same one.
 *
 * The list here is only the fields somebody TYPES INTO. A country, an area of
 * expertise, a gender, a level, a date of birth and an account type are all
 * chosen rather than typed, and each already has a control that fits the
 * question. See `ProfileScreen.tsx` for which is which and why.
 */

/**
 * The fields of the form that are held as a plain string, so a row can print
 * one and a panel can hand one straight back.
 */
type StringValuedField = {
  [K in keyof ProfileFormValues]: ProfileFormValues[K] extends string
    ? K
    : never;
}[keyof ProfileFormValues];

/**
 * The typed fields, in the order the screen shows them.
 *
 * `Extract` is doing real work rather than decorating a union: a name that is
 * misspelled, or that names something this form holds as a LIST rather than a
 * string, drops out of the type and its entry in the table below then fails to
 * compile as a key nobody asked for. Without it both mistakes would survive as
 * far as a row printing an array.
 */
export type ProfileTextFieldName = Extract<
  StringValuedField,
  | 'name'
  | 'username'
  | 'bio'
  | 'state'
  | 'city'
  | 'address'
  | 'university'
  | 'law_school'
  | 'call_to_bar_year'
  | 'call_number'
  | 'other_certifications'
  | 'work_experience'
  | 'linkedin_url'
  | 'website_url'
  | 'twitter_url'
  | 'facebook_url'
>;

export interface ProfileTextFieldSpec {
  /** Decorative, on the row. The label is the accessible name. */
  icon: LucideIcon;
  label: string;
  /**
   * Shown inside the CONTROL, and never on the row. The row states a fact and
   * says "Not set" when it holds none; the panel is where somebody is typing,
   * so it is the place a worked example belongs.
   */
  placeholder: string;
  /** One quiet sentence under the control, in the panel only. */
  hint?: string;
  /** Several lines, so a textarea rather than an input. */
  multiline?: boolean;
  maxLength?: number;
  /** A fixed glyph before the value, in both places (the handle's `@`). */
  prefix?: string;
  type?: 'text' | 'url';
  inputMode?: 'text' | 'url' | 'numeric';
  autoComplete?: string;
  spellCheck?: boolean;
  /**
   * Folded in as the value is typed, so a valid answer is never reported back
   * as a mistake. Only the handle has one.
   */
  transform?: (value: string) => string;
}

export const PROFILE_TEXT_FIELDS: Record<
  ProfileTextFieldName,
  ProfileTextFieldSpec
> = {
  name: {
    icon: UserPen,
    label: 'Full name',
    placeholder: 'Your full name',
    maxLength: PROFILE_LIMITS.name,
    autoComplete: 'name',
  },
  username: {
    icon: AtSign,
    label: 'Username',
    placeholder: 'yourhandle',
    /* One sentence for both states. The row already says whether a handle is
       set, so a hint that changes with it would only repeat the row. */
    hint: 'People type this to tag you in channels. Once you have one it cannot be removed.',
    prefix: '@',
    maxLength: PROFILE_LIMITS.usernameMax,
    autoComplete: 'off',
    spellCheck: false,
    transform: normaliseUsername,
  },
  bio: {
    icon: NotebookPen,
    label: 'Bio',
    placeholder: 'A line or two about yourself',
    multiline: true,
    maxLength: PROFILE_LIMITS.bio,
  },
  state: {
    icon: MapPin,
    label: 'State or region',
    placeholder: 'The state or region you live in',
    maxLength: PROFILE_LIMITS.state,
    autoComplete: 'address-level1',
  },
  city: {
    icon: Building,
    label: 'City',
    placeholder: 'The city you live in',
    maxLength: PROFILE_LIMITS.city,
    autoComplete: 'address-level2',
  },
  address: {
    icon: House,
    label: 'Address',
    placeholder: 'Your street address',
    maxLength: PROFILE_LIMITS.address,
    autoComplete: 'street-address',
  },
  university: {
    icon: School,
    label: 'University',
    placeholder: 'Where you study',
  },
  law_school: {
    icon: Landmark,
    label: 'Law school',
    placeholder: 'Where you went to law school',
  },
  call_to_bar_year: {
    icon: CalendarDays,
    label: 'Year of call',
    placeholder: 'e.g. 2020',
    inputMode: 'numeric',
    maxLength: 4,
  },
  call_number: {
    icon: IdCard,
    label: 'Call number',
    placeholder: 'Your call number',
  },
  other_certifications: {
    icon: Award,
    label: 'Other certifications',
    placeholder: 'Anything else you are certified in',
    multiline: true,
  },
  work_experience: {
    icon: Briefcase,
    label: 'Work experience',
    placeholder: 'Where you have practised, and for how long',
    multiline: true,
  },
  linkedin_url: {
    icon: Linkedin,
    label: 'LinkedIn',
    placeholder: 'https://linkedin.com/in/...',
    type: 'url',
    inputMode: 'url',
    autoComplete: 'off',
    spellCheck: false,
  },
  website_url: {
    icon: Link2,
    label: 'Website',
    placeholder: 'https://yoursite.com',
    type: 'url',
    inputMode: 'url',
    autoComplete: 'off',
    spellCheck: false,
  },
  twitter_url: {
    icon: Twitter,
    label: 'X',
    placeholder: 'https://x.com/...',
    type: 'url',
    inputMode: 'url',
    autoComplete: 'off',
    spellCheck: false,
  },
  facebook_url: {
    icon: Facebook,
    label: 'Facebook',
    placeholder: 'https://facebook.com/...',
    type: 'url',
    inputMode: 'url',
    autoComplete: 'off',
    spellCheck: false,
  },
};
