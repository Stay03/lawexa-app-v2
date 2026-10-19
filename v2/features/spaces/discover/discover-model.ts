import type { DiscoverableSpace } from '@/types/collab';

/**
 * discover-model — what a Discover card offers the reader (public shared
 * spaces, Arthur, 15 October 2026: listed here, people ask to join and the
 * space's Owner approves in the People tab). No JSX, so the tests pin it.
 *
 *  - `open`:    the reader is a member; the card opens the space.
 *  - `ask`:     a shared space they are not in; the card asks to join.
 *  - `pending`: their ask is waiting for the Owner; the card says so and can
 *               take it back.
 *  - `join`:    an older public team space, which anyone may join at once.
 *
 * The server's `my_status` decides; the older `is_member` is read only when
 * it is absent.
 */
export type DiscoverAction = 'open' | 'ask' | 'pending' | 'join';

export function discoverAction(
  space: Pick<DiscoverableSpace, 'kind' | 'my_status' | 'is_member'>,
): DiscoverAction {
  if (space.my_status === 'member' || (space.my_status === undefined && space.is_member === true)) {
    return 'open';
  }
  if ((space.kind ?? 'team') === 'team') return 'join';
  return space.my_status === 'pending' ? 'pending' : 'ask';
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

/** Why an ask was refused. */
export function askRefusal(status: number | undefined, hasAccount: boolean): Refusal {
  if (status === 409) return { text: 'You are already in this space.', offerAccount: false };
  if (status === 404) return { text: 'This space is no longer public.', offerAccount: false };
  if (status === 403) {
    return hasAccount
      ? { text: "This space isn't taking requests from your account.", offerAccount: false }
      : { text: 'You need a Lawexa account to ask to join.', offerAccount: true };
  }
  return { text: "That didn't work. Try again in a moment.", offerAccount: false };
}

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
