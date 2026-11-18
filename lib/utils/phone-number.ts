/**
 * The optional phone number (Arthur, 18 November 2026, thread bbdef040;
 * Backend's contract the same evening). The server's own rule, checked here
 * too because onboarding saves each step without waiting for the answer, so a
 * refusal there would never reach the person:
 *  - spaces, dashes, dots and brackets are ignored;
 *  - "+" then 8 to 15 digits, or a Nigerian local number: 0 then 10 digits
 *    (0803 123 4567), which the server stores as +2348031234567;
 *  - empty is fine: the number is optional.
 */

export const PHONE_PROBLEM = 'Enter a phone number with its country code, for example +2348031234567.';

/** The number with the ignored characters taken out. */
export function phoneDigits(raw: string): string {
  return raw.replace(/[\s\-.()]/g, '');
}

/** The server's sentence when the number would be refused, or null when it can go (empty included). */
export function phoneProblem(raw: string): string | null {
  const value = phoneDigits(raw);
  if (value === '') return null;
  if (/^\+\d{8,15}$/.test(value)) return null;
  if (/^0\d{10}$/.test(value)) return null;
  return PHONE_PROBLEM;
}

/**
 * The number as the server stores it, so a form's saved baseline matches what
 * comes back: the ignored characters out, and a Nigerian local number given
 * its country code (0803… becomes +234803…). Empty stays empty. A number the
 * server would refuse is returned as typed, for the refusal to name.
 */
export function storedPhone(raw: string): string {
  const value = phoneDigits(raw);
  if (/^0\d{10}$/.test(value)) return `+234${value.slice(1)}`;
  return phoneProblem(raw) === null ? value : raw.trim();
}

/** "+2348031234567" as people read it: "+234 803 123 4567"; other countries are left as sent. */
export function formatPhone(stored: string | null | undefined): string {
  if (!stored) return '';
  const nigerian = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(stored);
  return nigerian ? `+234 ${nigerian[1]} ${nigerian[2]} ${nigerian[3]}` : stored;
}
