/**
 * "How did you hear about us?" (Arthur, 18 November 2026, thread bbdef040;
 * Backend's contract). Optional. The choices and their words are Backend's;
 * "Other" needs a few words of its own, at most 100.
 */

export const HEARD_ABOUT_OPTIONS = [
  { value: 'friend_or_colleague', label: 'Friend or colleague' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'university_or_law_school', label: 'University or law school' },
  { value: 'event', label: 'Event' },
  { value: 'search_engine', label: 'Search engine' },
  { value: 'other', label: 'Other' },
] as const;

export type HeardAbout = (typeof HEARD_ABOUT_OPTIONS)[number]['value'];

export const HEARD_ABOUT_OTHER_MAX = 100;
export const HEARD_ABOUT_OTHER_MISSING = 'Tell us where you heard about Lawexa.';

export function isHeardAbout(value: unknown): value is HeardAbout {
  return HEARD_ABOUT_OPTIONS.some((option) => option.value === value);
}

/** The server's sentence when the answer would be refused, or null when it can go (no answer included). */
export function heardAboutProblem(choice: string | null, other: string): string | null {
  if (choice === null || choice === '') return null;
  if (!isHeardAbout(choice)) return 'Choose one of the listed options.';
  if (choice !== 'other') return null;
  const words = other.trim();
  if (words === '') return HEARD_ABOUT_OTHER_MISSING;
  if (words.length > HEARD_ABOUT_OTHER_MAX) return `Keep this to ${HEARD_ABOUT_OTHER_MAX} characters or fewer.`;
  return null;
}

/** What the request sends: nothing when unanswered; the "other" words only with "Other". */
export function heardAboutPayload(choice: string | null, other: string): { heard_about?: HeardAbout; heard_about_other?: string } {
  if (!isHeardAbout(choice)) return {};
  return choice === 'other' ? { heard_about: choice, heard_about_other: other.trim() } : { heard_about: choice };
}

/** How an admin reads the answer: the label, or the person's own words for "Other". */
export function heardAboutLabel(choice: string | null | undefined, other?: string | null): string | null {
  if (!choice) return null;
  if (choice === 'other') return other?.trim() ? `Other: ${other.trim()}` : 'Other';
  return HEARD_ABOUT_OPTIONS.find((option) => option.value === choice)?.label ?? choice;
}
