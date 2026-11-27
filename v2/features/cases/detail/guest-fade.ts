import type { CaseDetail, CaseLockedPreview, ReportPrinciple } from '@/types/case';

type LockCase = Partial<
  Pick<CaseDetail, 'limit_exceeded' | 'report_principles' | 'principles' | 'locked_preview'>
>;

/** Whether the case carries principles in either shape: structured rows or
 *  the flat editorial string. */
export function hasPrinciples(detail: LockCase): boolean {
  return (detail.report_principles?.length ?? 0) > 0 || !!detail.principles?.trim();
}

/**
 * Who the case is locked for, or null when it is not locked.
 *
 * The server says so with `locked_preview.reader` (guest-locks, 27 November
 * 2026): a guest, or a signed-in reader without a paid plan (`member`). A
 * server without that field (the one live before it) locks only a guest's
 * case, with `limit_exceeded` and the principles still sent, so the screen
 * reads that as today. A signed-in reader over the monthly limit on that
 * server is not locked here: the summary section keeps the upgrade card.
 */
export function caseLockReader(
  detail: LockCase,
  role: string | null | undefined,
): CaseLockedPreview['reader'] | null {
  if (detail.locked_preview) return detail.locked_preview.reader;
  return role === 'guest' && detail.limit_exceeded === true ? 'guest' : null;
}

/**
 * A locked case's principles fade into the offer and the summary section
 * stays away (v2 Stage 1, item 1, A2; Stay, 19 October 2026, 14:09 UTC: "No
 * summary. Fade principles. It's enough"). A case with no principles keeps
 * the summary section, with the offer's card in it.
 */
export function principlesFadeIntoOffer(
  detail: LockCase,
  role: string | null | undefined,
): boolean {
  if (detail.locked_preview) return detail.locked_preview.second !== null;
  return caseLockReader(detail, role) !== null && hasPrinciples(detail);
}

/**
 * A locked case ends at the offer: nothing is drawn under it, and the outline
 * rail has nothing to map (Stay, 19 October 2026, 14:57 UTC: "There should be
 * nothing under the create account area at the bottom").
 */
export function caseEndsAtTheOffer(
  detail: LockCase,
  role: string | null | undefined,
): boolean {
  return caseLockReader(detail, role) !== null;
}

/**
 * Which ONE block of principles a locked reader sees before the offer (Stay,
 * 19 October 2026, 14:57 UTC: "only one piece of text that should show and
 * fade. Either principle only or editorial principles only"). The server
 * picks it when it sends `locked_preview`; otherwise the preferred kind when
 * the case has it, else the other. One setting: {@link GUEST_PRINCIPLES_FIRST}.
 */
export type GuestPrinciplesSource = 'editorial' | 'report';

/** The kind a locked reader sees when a case has both. */
export const GUEST_PRINCIPLES_FIRST: GuestPrinciplesSource = 'editorial';

export function guestPrinciplesSource(
  detail: LockCase,
  first: GuestPrinciplesSource = GUEST_PRINCIPLES_FIRST,
): GuestPrinciplesSource | null {
  if (detail.locked_preview) return detail.locked_preview.source;
  const editorial = !!detail.principles?.trim();
  const report = (detail.report_principles?.length ?? 0) > 0;
  if (first === 'editorial') return editorial ? 'editorial' : report ? 'report' : null;
  return report ? 'report' : editorial ? 'editorial' : null;
}

/**
 * The server's first entry as the principle the caption and passage draw. It
 * has no id, order or judge link: the locked page links nowhere.
 */
export function lockedReportPrinciple(entry: NonNullable<CaseLockedPreview['first']>): ReportPrinciple {
  return {
    id: 0,
    order: 0,
    principle: entry.text,
    verbatim_window: entry.verbatim_window ?? null,
    type: entry.type ?? null,
    law_type: entry.law_type ?? null,
    tag: entry.tag ?? null,
    judge: entry.judge ? { id: 0, slug: '', name: entry.judge.name, role: entry.judge.role } : null,
    reviewed: entry.reviewed ?? true,
  };
}

/**
 * What the "Full judgment" button does. A locked case carries no report text
 * (`full_report` null), so the button leads to the offer, never to an empty
 * report page (Stay, 14:07 UTC: "Make sure full report button is there too").
 * A signed-in reader over the monthly limit on a server without the lock gets
 * no button, as before.
 */
export function fullReportAction(
  detail: Pick<CaseDetail, 'has_full_report' | 'limit_exceeded'> & LockCase,
  role: string | null | undefined,
): 'open' | 'offer' | null {
  if (detail.has_full_report !== true) return null;
  if (detail.limit_exceeded !== true && !detail.locked_preview) return 'open';
  return caseLockReader(detail, role) !== null ? 'offer' : null;
}
