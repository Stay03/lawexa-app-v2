import type { RadarEmailAudience } from '@/types/radar';

/**
 * The words for a space Radar's "Email reports to" (plan 6.2). Pure, so the
 * test can run them; the field and the review dialog draw them.
 */

/** Under the member list: how many are chosen, and what none means. */
export function chosenMembersLine(count: number): string {
  if (count === 0) return 'No one chosen yet: reports show in the Space and nobody gets an email.';
  return count === 1 ? '1 member chosen' : `${count} members chosen`;
}

/** The review dialog's "Reports" line for a space Radar. */
export function spaceReportsLine(spaceName: string, audience: RadarEmailAudience, chosen: number): string {
  if (audience === 'everyone') return `In ${spaceName}, and by email to every member`;
  if (chosen === 0) return `In ${spaceName}; no email`;
  return `In ${spaceName}, and by email to ${chosen === 1 ? '1 chosen member' : `${chosen} chosen members`}`;
}
