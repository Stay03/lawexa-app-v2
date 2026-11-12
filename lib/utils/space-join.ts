/**
 * What joining a public Space came to (Arthur's A, 12 November 2026, thread
 * dcd06933; WOZ's 324edd33): `201` joined, `202` with `{status: "pending"}`
 * a request the Owner decides on, for someone the Owner removed or turned
 * down. A joined reader goes into the Space; a request shows "Request sent".
 */
export type JoinOutcome = 'joined' | 'pending';

export function joinOutcome(httpStatus: number, data: unknown): JoinOutcome {
  const status = data && typeof data === 'object' && 'status' in data ? (data as { status: unknown }).status : null;
  return httpStatus === 202 || status === 'pending' ? 'pending' : 'joined';
}
