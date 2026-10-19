import type { CaseDetail } from '@/types/case';

type GuestFadeCase = Partial<Pick<CaseDetail, 'limit_exceeded' | 'report_principles' | 'principles'>>;

/** Whether the case carries principles in either shape: structured rows or
 *  the flat editorial string. */
export function hasPrinciples(detail: GuestFadeCase): boolean {
  return (detail.report_principles?.length ?? 0) > 0 || !!detail.principles?.trim();
}

/**
 * A guest's case that came without its summary (`limit_exceeded`): its
 * principles fade into the account offer and the summary section stays away
 * (v2 Stage 1, item 1, A2; Stay, 19 October 2026, 14:09 UTC: "No summary.
 * Fade principles. It's enough"). A case with no principles keeps the summary
 * section, with the offer's card in it. The fade is the screen's only: the
 * server still sends every principle.
 */
export function guestFadesPrinciples(
  detail: GuestFadeCase,
  role: string | null | undefined,
): boolean {
  return role === 'guest' && detail.limit_exceeded === true && hasPrinciples(detail);
}

/**
 * A guest's case without its summary ends at the account offer: nothing is
 * drawn under it, and the outline rail has nothing to map (Stay, 19 October
 * 2026, 14:57 UTC: "There should be nothing under the create account area at
 * the bottom").
 */
export function guestEndsAtTheOffer(
  detail: Pick<CaseDetail, 'limit_exceeded'>,
  role: string | null | undefined,
): boolean {
  return role === 'guest' && detail.limit_exceeded === true;
}

/**
 * Which ONE block of principles a guest reads before the offer (Stay, 19
 * October 2026, 14:57 UTC: "only one piece of text that should show and
 * fade. Either principle only or editorial principles only"). The preferred
 * kind when the case has it, else the other. One setting, so the pick can
 * change in one place: {@link GUEST_PRINCIPLES_FIRST}.
 */
export type GuestPrinciplesSource = 'editorial' | 'report';

/** The kind a guest reads when a case has both. */
export const GUEST_PRINCIPLES_FIRST: GuestPrinciplesSource = 'editorial';

export function guestPrinciplesSource(
  detail: GuestFadeCase,
  first: GuestPrinciplesSource = GUEST_PRINCIPLES_FIRST,
): GuestPrinciplesSource | null {
  const editorial = !!detail.principles?.trim();
  const report = (detail.report_principles?.length ?? 0) > 0;
  if (first === 'editorial') return editorial ? 'editorial' : report ? 'report' : null;
  return report ? 'report' : editorial ? 'editorial' : null;
}

/**
 * What a guest's "Full judgment" button does. A guest's case carries no
 * report text (`full_report` null, backend, 19 October 2026), so the button
 * leads to the account offer, never to an empty report page (Stay, 14:07 UTC:
 * "Make sure full report button is there too"). A signed-in reader over the
 * monthly limit gets no button, as before.
 */
export function fullReportAction(
  detail: Pick<CaseDetail, 'has_full_report' | 'limit_exceeded'>,
  role: string | null | undefined,
): 'open' | 'offer' | null {
  if (detail.has_full_report !== true) return null;
  if (detail.limit_exceeded !== true) return 'open';
  return role === 'guest' ? 'offer' : null;
}
