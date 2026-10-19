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
