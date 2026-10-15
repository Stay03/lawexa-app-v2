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

/** Why an ask was refused, in plain words. */
export function askRefusal(status: number | undefined): string {
  if (status === 409) return 'You are already in this space.';
  if (status === 404) return 'This space is no longer public.';
  if (status === 403) return 'You need a Lawexa account to ask to join.';
  return "That didn't work. Try again in a moment.";
}
