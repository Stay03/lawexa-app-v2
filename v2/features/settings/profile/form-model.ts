import {
  getProfileFieldVisibility,
  inferStudentEducationLevel,
  type ProfileFieldVisibility,
} from '@/lib/utils/profile-field-config';
import type { User, UserType } from '@/types/auth';
import type { StudentEducationLevel } from '@/types/onboarding';
import type { ProfileUpdatePayload } from '@/types/profile';

/**
 * profile/form-model: the profile form's values, scoping, validation, payload
 * and server-error mapping. A pure module (no React, no hooks), so the screen,
 * the picker and any future caller all read the same rules.
 *
 * ── WHY NOT `lib/utils/profile-validation.ts` ──────────────────────────────
 * That module is v1's, and it is a zod schema built for react-hook-form: its
 * import graph drags both libraries into any bundle that touches it, which is
 * exactly why `v2/features/radars/create/form-model.ts` restated the radar
 * rules instead of importing v1's. The v2 form is plain controlled state, so
 * the profile rules are restated here with the SAME semantics, measured field
 * by field against `profile-validation.ts` on 16 August 2026.
 *
 * `lib/utils/profile-field-config.ts` IS imported, deliberately. It is a pure
 * module with no library behind it, and it owns the one question that must
 * never have two answers: which fields apply to which kind of person.
 *
 * ── THE FIELD NAMES ARE THE API'S NAMES ────────────────────────────────────
 * `date_of_birth`, not `dateOfBirth`. This form is a direct projection of one
 * backend record, so snake_case keys let the payload builder and the 422 error
 * mapper line up one to one with the wire, and remove twenty-two lines of
 * renaming that could each be wrong on their own.
 *
 * ── WHAT v1 DID BADLY, AND WHAT THIS DOES INSTEAD ──────────────────────────
 * v1 built its payload with `if (values.bio) payload.bio = values.bio`, for
 * every field. An emptied field is falsy, so it never travelled: clearing your
 * bio, your city, your address or any of the four links enabled Save, showed
 * "Profile updated successfully", and the old value came back on the next
 * load. The write was never sent and nobody was told.
 *
 * So this builds a DIFF instead. A field travels when, and only when, it
 * differs from the value the server gave us, and a field the person emptied
 * travels as an empty string. Two consequences worth stating:
 *
 *  - a save carries only what actually changed, so a field this form does not
 *    surface can never be touched by it;
 *  - "is anything different?" is answered by the payload having a key, which
 *    is the same question the confirm button is disabled on. There is one
 *    definition of changed, not two.
 */

/** Mirrored from the backend and from v1's schema. */
export const PROFILE_LIMITS = {
  name: 255,
  usernameMin: 3,
  usernameMax: 30,
  bio: 500,
  state: 255,
  city: 255,
  address: 500,
  earliestCallYear: 1900,
} as const;

/**
 * The handle's shape, mirrored from the backend (2026-08-05): 3 to 30
 * characters, lowercase letters, numbers and underscores, first character a
 * letter or number. Checked here so an obvious mistake costs no round trip;
 * the server stays the only authority on reserved and already-taken handles.
 */
const USERNAME_ALLOWED = /^[a-z0-9_]+$/;
const USERNAME_START = /^[a-z0-9]/;

/**
 * The form's values. Every one is a string (or a list of ids) because every
 * one is what a control holds: numbers are parsed at the payload boundary, so
 * a half-typed year is a value the form can carry rather than a crash.
 */
export interface ProfileFormValues {
  name: string;
  /** The `@handle`, without the `@`. Empty means the account has none yet. */
  username: string;
  bio: string;
  gender: string;
  date_of_birth: string;
  /** Empty means the account has never chosen one. */
  user_type: UserType | '';
  /**
   * LOCAL ONLY, and never in the payload. The backend does not store where a
   * law student studies: it is inferred from which of `university` and
   * `law_school` holds a value (`inferStudentEducationLevel`). The form needs
   * it as a real value because it decides which of those two fields is shown.
   */
  student_education_level: StudentEducationLevel | null;
  profession: string;
  country: string;
  state: string;
  city: string;
  address: string;
  areas_of_expertise: number[];
  university: string;
  level: string;
  law_school: string;
  /** Text, because the control is text. Parsed in `buildProfilePayload`. */
  call_to_bar_year: string;
  call_number: string;
  other_certifications: string;
  work_experience: string;
  linkedin_url: string;
  website_url: string;
  twitter_url: string;
  facebook_url: string;
}

/**
 * The update payload, which is v1's with ONE widening: a call-to-bar year can
 * be cleared.
 *
 * v1 typed it `number | undefined` because v1 could not clear anything, so
 * "absent" was the only state it ever needed. This form can empty the field,
 * and an empty string is not a year, so the clear is spelled `null`. Every
 * other field clears with `''`, which the typed contract already allows.
 */
export type ProfileSavePayload = Omit<
  ProfileUpdatePayload,
  'call_to_bar_year'
> & {
  call_to_bar_year?: number | null;
};

/** The form's addressable error slots. `form` is the whole-form message for a
 *  server error that matched no field, rendered in-page and never as a toast. */
export type ProfileFieldName =
  | 'name'
  | 'username'
  | 'bio'
  | 'gender'
  | 'date_of_birth'
  | 'user_type'
  | 'profession'
  | 'country'
  | 'state'
  | 'city'
  | 'address'
  | 'areas_of_expertise'
  | 'university'
  | 'level'
  | 'law_school'
  | 'call_to_bar_year'
  | 'call_number'
  | 'other_certifications'
  | 'work_experience'
  | 'linkedin_url'
  | 'website_url'
  | 'twitter_url'
  | 'facebook_url'
  | 'form';

export type ProfileFieldErrors = Partial<Record<ProfileFieldName, string>>;

/** The values the account holds today, as the form's own shape. */
export function profileFormValuesFromUser(user: User): ProfileFormValues {
  const profile = user.profile;
  return {
    name: user.name ?? '',
    username: user.username ?? '',
    bio: profile?.bio ?? '',
    gender: profile?.gender ?? '',
    date_of_birth: profile?.date_of_birth ?? '',
    user_type: profile?.user_type ?? '',
    student_education_level: inferStudentEducationLevel(
      profile?.user_type,
      profile?.university,
      profile?.law_school,
    ),
    profession: profile?.profession ?? '',
    country: profile?.country ?? '',
    state: profile?.state ?? '',
    city: profile?.city ?? '',
    address: profile?.address ?? '',
    areas_of_expertise: (user.areas_of_expertise ?? []).map((area) => area.id),
    university: profile?.university ?? '',
    level: profile?.level ?? '',
    law_school: profile?.law_school ?? '',
    call_to_bar_year:
      profile?.call_to_bar_year == null ? '' : String(profile.call_to_bar_year),
    call_number: profile?.call_number ?? '',
    other_certifications: profile?.other_certifications ?? '',
    work_experience: profile?.work_experience ?? '',
    linkedin_url: profile?.linkedin_url ?? '',
    website_url: profile?.website_url ?? '',
    twitter_url: profile?.twitter_url ?? '',
    facebook_url: profile?.facebook_url ?? '',
  };
}

/** Which fields apply to the person these values describe. */
export function visibilityFor(
  values: ProfileFormValues,
): ProfileFieldVisibility {
  return getProfileFieldVisibility(
    values.user_type || undefined,
    values.student_education_level,
    values.profession,
  );
}

/** The conditional text fields, which the scoping rule below acts on. */
type ScopedTextField =
  | 'university'
  | 'level'
  | 'law_school'
  | 'call_to_bar_year'
  | 'call_number'
  | 'other_certifications'
  | 'work_experience';

/**
 * THE STATE A SUCCESSFUL SAVE LEAVES THIS ACCOUNT IN, as far as this form can
 * know it. Everything that is not a plain copy of what somebody typed happens
 * here, exactly once, so the payload and the form's own baseline can never tell
 * two different stories about what was written.
 *
 * ── SCOPING TO THE ACCOUNT TYPE ────────────────────────────────────────────
 * The rule has two halves, and the second is the one that matters:
 *
 *  - a field that does not apply and never did is left EXACTLY as the server
 *    gave it, so it produces no diff and this form cannot touch data it never
 *    showed anybody. A lawyer who never opens the type control does not have a
 *    stray `university` value silently deleted by pressing Save;
 *  - a field that applied a moment ago and does not any more is CLEARED, and
 *    the clear is sent. A lawyer who becomes a student stops having a call
 *    number, in the record as well as on the screen.
 *
 * v1 did the first half of the second case only: its effects blanked those
 * fields in the form and its payload builder then dropped them for being
 * falsy, so the screen said they were gone and the record still held them.
 *
 * ── TRIMMING, AND THE TWO THINGS THAT CANNOT BE UNSET ──────────────────────
 * Single-line fields are trimmed: a stray space is neither stored nor counted
 * as a change. The three multi-line fields (bio, certifications, work
 * experience) are left as typed, because their whitespace is the author's.
 *
 * A handle and an account type can each be CHOSEN but not removed (the backend
 * has no spelling for either), so an empty one means "unchanged" rather than
 * "clear it", and the settled value falls back to what the account holds.
 */
export function settleProfileValues(
  next: ProfileFormValues,
  original: ProfileFormValues,
): ProfileFormValues {
  const settled: ProfileFormValues = {
    ...next,
    name: next.name.trim(),
    username: normaliseUsername(next.username).trim() || original.username,
    user_type: next.user_type || original.user_type,
    country: next.country.trim(),
    state: next.state.trim(),
    city: next.city.trim(),
    address: next.address.trim(),
    university: next.university.trim(),
    level: next.level.trim(),
    law_school: next.law_school.trim(),
    call_to_bar_year: next.call_to_bar_year.trim(),
    call_number: next.call_number.trim(),
    linkedin_url: next.linkedin_url.trim(),
    website_url: next.website_url.trim(),
    twitter_url: next.twitter_url.trim(),
    facebook_url: next.facebook_url.trim(),
  };

  const nextVisibility = visibilityFor(settled);
  const originalVisibility = visibilityFor(original);

  const scope = (
    field: ScopedTextField,
    visible: boolean,
    wasVisible: boolean,
  ) => {
    if (visible) return;
    settled[field] = wasVisible ? '' : original[field];
  };

  scope(
    'university',
    nextVisibility.showUniversity,
    originalVisibility.showUniversity,
  );
  scope('level', nextVisibility.showLevel, originalVisibility.showLevel);
  scope(
    'law_school',
    nextVisibility.showLawSchool,
    originalVisibility.showLawSchool,
  );
  scope(
    'call_to_bar_year',
    nextVisibility.showCallToBarYear,
    originalVisibility.showCallToBarYear,
  );
  scope(
    'call_number',
    nextVisibility.showCallNumber,
    originalVisibility.showCallNumber,
  );
  scope(
    'other_certifications',
    nextVisibility.showOtherCertifications,
    originalVisibility.showOtherCertifications,
  );
  scope(
    'work_experience',
    nextVisibility.showWorkExperience,
    originalVisibility.showWorkExperience,
  );

  // PROFESSION IS DERIVED for the two types that name one. v1 did the same, in
  // two places (the type switcher wrote it, the payload builder wrote it
  // again); here the derivation is stated once and the control is simply not
  // shown to anybody whose type already answers the question.
  if (settled.user_type === 'lawyer') {
    settled.profession = 'lawyer';
  } else if (settled.user_type === 'law_student') {
    settled.profession = 'student';
  } else if (!nextVisibility.showProfession) {
    settled.profession = original.profession;
  } else {
    settled.profession = next.profession.trim();
  }

  if (!nextVisibility.showAreasOfExpertise) {
    settled.areas_of_expertise = originalVisibility.showAreasOfExpertise
      ? []
      : original.areas_of_expertise;
  }

  return settled;
}

/** Whether two id lists hold the same members, order ignored. */
function sameIds(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  return b.every((id) => seen.has(id));
}

/**
 * The payload: everything in the SETTLED values that differs from what the
 * server gave us, and nothing else. An empty object means nothing changed,
 * which is exactly what the confirm button is disabled on.
 *
 * Every rule that is not "did this differ?" lives in `settleProfileValues`, so
 * this function is only a comparison and cannot invent a rule of its own.
 */
export function buildProfilePayload(
  next: ProfileFormValues,
  original: ProfileFormValues,
): ProfileSavePayload {
  const values = settleProfileValues(next, original);
  const payload: ProfileSavePayload = {};

  if (values.name !== original.name) payload.name = values.name;
  if (values.username !== original.username) payload.username = values.username;
  if (values.user_type && values.user_type !== original.user_type) {
    payload.user_type = values.user_type;
  }
  if (values.profession !== original.profession) {
    payload.profession = values.profession;
  }

  if (values.bio !== original.bio) payload.bio = values.bio;
  if (values.gender !== original.gender) payload.gender = values.gender;
  if (values.date_of_birth !== original.date_of_birth) {
    payload.date_of_birth = values.date_of_birth;
  }

  if (values.country !== original.country) payload.country = values.country;
  if (values.state !== original.state) payload.state = values.state;
  if (values.city !== original.city) payload.city = values.city;
  if (values.address !== original.address) payload.address = values.address;

  if (values.university !== original.university) {
    payload.university = values.university;
  }
  if (values.level !== original.level) payload.level = values.level;
  if (values.law_school !== original.law_school) {
    payload.law_school = values.law_school;
  }
  if (values.call_number !== original.call_number) {
    payload.call_number = values.call_number;
  }
  if (values.other_certifications !== original.other_certifications) {
    payload.other_certifications = values.other_certifications;
  }
  if (values.work_experience !== original.work_experience) {
    payload.work_experience = values.work_experience;
  }

  // The one numeric field. An emptied year has no number to send, so the clear
  // is `null` (see `ProfileSavePayload`); a year that is present has already
  // passed validation, so the parse cannot fail here.
  if (values.call_to_bar_year !== original.call_to_bar_year) {
    const parsed = Number.parseInt(values.call_to_bar_year, 10);
    payload.call_to_bar_year = Number.isInteger(parsed) ? parsed : null;
  }

  if (values.linkedin_url !== original.linkedin_url) {
    payload.linkedin_url = values.linkedin_url;
  }
  if (values.website_url !== original.website_url) {
    payload.website_url = values.website_url;
  }
  if (values.twitter_url !== original.twitter_url) {
    payload.twitter_url = values.twitter_url;
  }
  if (values.facebook_url !== original.facebook_url) {
    payload.facebook_url = values.facebook_url;
  }

  // The backend replaces this list wholesale, so it travels in full or not at
  // all. An empty list is a real answer and does travel, which is how somebody
  // removes their last area of expertise (v1 could not: it sent the list only
  // when it had members).
  if (!sameIds(values.areas_of_expertise, original.areas_of_expertise)) {
    payload.areas_of_expertise = values.areas_of_expertise;
  }

  return payload;
}

/** Whether a payload would actually write anything. */
export function hasChanges(payload: ProfileSavePayload): boolean {
  return Object.keys(payload).length > 0;
}

/** An absolute http(s) address, which is the only kind any of these fields
 *  should hold. v1's zod `.url()` accepted any protocol, including `mailto:`. */
function isWebUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function urlError(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  return isWebUrl(value)
    ? undefined
    : 'Enter a full address, starting with https://';
}

/**
 * Client-side validation, for the fields the controls cannot already enforce.
 *
 * Only what is SHOWN is checked: a call-to-bar year left behind by a former
 * lawyer is not this person's problem, and the scoping rule above is about to
 * clear it anyway. The server stays the authority on everything it alone knows
 * (a taken handle, a reserved word), and those come back as 422s.
 */
export function validateProfileForm(
  values: ProfileFormValues,
  visibility: ProfileFieldVisibility,
): { fields: ProfileFieldErrors; ok: boolean } {
  const fields: ProfileFieldErrors = {};

  const name = values.name.trim();
  if (!name) {
    fields.name = 'Enter your name.';
  } else if (name.length > PROFILE_LIMITS.name) {
    fields.name = `Keep your name to ${PROFILE_LIMITS.name} characters or fewer.`;
  }

  const username = values.username.trim();
  if (username) {
    if (username.length < PROFILE_LIMITS.usernameMin) {
      fields.username = `A username is at least ${PROFILE_LIMITS.usernameMin} characters.`;
    } else if (username.length > PROFILE_LIMITS.usernameMax) {
      fields.username = `A username is at most ${PROFILE_LIMITS.usernameMax} characters.`;
    } else if (!USERNAME_ALLOWED.test(username)) {
      fields.username = 'Use lowercase letters, numbers and underscores only.';
    } else if (!USERNAME_START.test(username)) {
      fields.username = 'Start with a letter or a number.';
    }
  }

  if (values.bio.length > PROFILE_LIMITS.bio) {
    fields.bio = `Keep your bio to ${PROFILE_LIMITS.bio} characters or fewer.`;
  }

  if (values.date_of_birth) {
    const parsed = new Date(values.date_of_birth);
    if (Number.isNaN(parsed.getTime())) {
      fields.date_of_birth = 'Enter a real date.';
    } else if (parsed >= new Date()) {
      fields.date_of_birth = 'Your date of birth is in the past.';
    }
  }

  if (values.state.trim().length > PROFILE_LIMITS.state) {
    fields.state = `Keep this to ${PROFILE_LIMITS.state} characters or fewer.`;
  }
  if (values.city.trim().length > PROFILE_LIMITS.city) {
    fields.city = `Keep this to ${PROFILE_LIMITS.city} characters or fewer.`;
  }
  if (values.address.trim().length > PROFILE_LIMITS.address) {
    fields.address = `Keep this to ${PROFILE_LIMITS.address} characters or fewer.`;
  }

  if (visibility.showCallToBarYear && values.call_to_bar_year.trim()) {
    const year = Number(values.call_to_bar_year.trim());
    const thisYear = new Date().getFullYear();
    if (
      !Number.isInteger(year) ||
      year < PROFILE_LIMITS.earliestCallYear ||
      year > thisYear
    ) {
      fields.call_to_bar_year = `Enter a year between ${PROFILE_LIMITS.earliestCallYear} and ${thisYear}.`;
    }
  }

  const linkedin = urlError(values.linkedin_url);
  if (linkedin) fields.linkedin_url = linkedin;
  const website = urlError(values.website_url);
  if (website) fields.website_url = website;
  const twitter = urlError(values.twitter_url);
  if (twitter) fields.twitter_url = twitter;
  const facebook = urlError(values.facebook_url);
  if (facebook) fields.facebook_url = facebook;

  return { fields, ok: Object.keys(fields).length === 0 };
}

/** The names a 422 may address. `form` is not one: it is where an unmatched
 *  message goes, and no server sends it. */
const SERVER_FIELD_NAMES: ReadonlySet<string> = new Set<ProfileFieldName>([
  'name',
  'username',
  'bio',
  'gender',
  'date_of_birth',
  'user_type',
  'profession',
  'country',
  'state',
  'city',
  'address',
  'areas_of_expertise',
  'university',
  'level',
  'law_school',
  'call_to_bar_year',
  'call_number',
  'other_certifications',
  'work_experience',
  'linkedin_url',
  'website_url',
  'twitter_url',
  'facebook_url',
]);

/**
 * Map a 422 error bag onto the form's slots. An indexed key
 * ("areas_of_expertise.2") collapses onto its root field, the rule v1's radar
 * mapping already proved. `matched` tells the caller whether ANY message found
 * a home, so it only claims "check the highlighted fields" when something
 * really highlighted; everything else becomes the in-page whole-form message.
 */
export function mapServerErrors(errors: Record<string, string[]>): {
  fields: ProfileFieldErrors;
  matched: boolean;
} {
  const fields: ProfileFieldErrors = {};
  let matched = false;
  for (const [key, messages] of Object.entries(errors)) {
    const root = key.split('.')[0];
    if (!SERVER_FIELD_NAMES.has(root) || messages.length === 0) continue;
    fields[root as ProfileFieldName] = messages[0];
    matched = true;
  }
  return { fields, matched };
}

/**
 * People paste handles with the leading `@`, and the server accepts lowercase
 * only. Both are folded away as they type, so a valid choice is never reported
 * back as a mistake (carried over from v1's `normalizeUsername`).
 */
export function normaliseUsername(value: string): string {
  return value.replace(/^@+/, '').toLowerCase();
}
