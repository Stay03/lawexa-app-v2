/**
 * What joining a public Space came to (Arthur's A, 12 November 2026, thread
 * dcd06933; WOZ's 324edd33): `201` joined, `202` with `{status: "pending"}`
 * a request the Owner decides on, for someone the Owner removed or turned
 * down. A joined reader goes into the Space; a request shows "Request sent".
 */
export type JoinOutcome = 'joined' | 'pending';

export function joinOutcome(httpStatus: number, data: unknown): JoinOutcome {
  const answer = data && typeof data === 'object' ? (data as { status?: unknown; is_pending?: unknown }) : null;
  // The membership says `is_pending` (Backend, 14 November 2026); `status` is the older word.
  return httpStatus === 202 || answer?.is_pending === true || answer?.status === 'pending' ? 'pending' : 'joined';
}
