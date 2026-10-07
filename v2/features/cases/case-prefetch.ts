import type { CaseDetailResponse } from '@/types/case';

/**
 * Who may read a case ahead of the tap. Guests are view-only before they
 * register and a reader with no session cannot read the case list at all, so
 * both are left to the open's own read.
 */
export function canPrefetchCase(session: {
  signedIn: boolean;
  userId: number | null;
  role: string | null;
}): boolean {
  return session.signedIn && session.userId !== null && session.role !== 'guest';
}

/**
 * A prefetched answer the case screen can draw from: a successful read that
 * carries the case. Anything else (no answer yet, a failed read) leaves the
 * loading boundary on its skeleton.
 */
export function drawableCase(answer: CaseDetailResponse | undefined): boolean {
  return answer?.success === true && answer.data !== null && answer.data !== undefined;
}
