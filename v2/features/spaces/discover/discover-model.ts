import type { DiscoverableSpace } from '@/types/collab';

/**
 * discover-model — what a Discover card offers the reader (public Spaces,
 * Arthur's A, 12 November 2026, thread dcd06933: anyone new joins a public
 * Space at once; someone the Owner removed or turned down sends a request the
 * Owner decides on). No JSX, so the tests pin it.
 *
 *  - `open`:    the reader is a member; the card opens the space.
 *  - `join`:    they are not in it; the card joins, or the server makes it a
 *               request (`joinOutcome`).
 *  - `pending`: their request is waiting for the Owner; the card says so and
 *               can take it back.
 *
 * The server's `my_status` decides; the older `is_member` is read only when
 * it is absent.
 */
export type DiscoverAction = 'open' | 'pending' | 'join';

export function discoverAction(space: Pick<DiscoverableSpace, 'my_status' | 'is_member'>): DiscoverAction {
  if (space.my_status === 'member' || (space.my_status === undefined && space.is_member === true)) {
    return 'open';
  }
  return space.my_status === 'pending' ? 'pending' : 'join';
}

/**
 * Why a join or an ask was refused, in plain words, and whether to offer an
 * account. Only a visitor without one is offered one, and only for the
 * server's 403, which is how the server says "an account is needed". A
 * signed-in reader who meets a 403 is told the space does not let them in;
 * every other failure says what it is. (The card used to put "Create an
 * account" under every failure, for everyone: Tester Claude's walk, 18
 * October 2026; v2 Stage 1, item 3.)
 */
export interface Refusal {
  text: string;
  offerAccount: boolean;
}

/** Taking back a request failed: the card still shows it, so trying again is the way on. */
export const CANCEL_FAILED: Refusal = { text: "Your request wasn't taken back. Try again in a moment.", offerAccount: false };

/** Why a join was refused. */
export function joinRefusal(status: number | undefined, hasAccount: boolean): Refusal {
  if (status === 409) return { text: 'You are already in this space.', offerAccount: false };
  if (status === 404) return { text: 'This space is no longer public.', offerAccount: false };
  if (status === 403) {
    return hasAccount
      ? { text: "This space doesn't let your account join.", offerAccount: false }
      : { text: 'You need a Lawexa account to join. You can keep reading without one.', offerAccount: true };
  }
  return { text: "That didn't work. Try again in a moment.", offerAccount: false };
}
