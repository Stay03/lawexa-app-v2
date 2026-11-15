import type { SpaceLimit } from '@/lib/utils/space-limit';
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

export function discoverAction(space: Pick<DiscoverableSpace, 'kind' | 'my_status' | 'is_member'>): DiscoverAction {
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
  /** A Space limit (organisation plans): the way to the plans goes beside the server's sentence. */
  offerPlans?: boolean;
}

/** Taking back a request failed: the card still shows it, so trying again is the way on. */
export const CANCEL_FAILED: Refusal = { text: "Your request wasn't taken back. Try again in a moment.", offerAccount: false };

/**
 * "Already an active member" is not a refusal: the reader is in, and a list
 * read before they joined still offered Join, so the card opens the Space
 * (Arthur, 14 November 2026). Only the server's code says so
 * (`errors.code: "already_member"`, Backend): any other 409, a Space that is
 * full one day, shows its own message and opens nothing (Fable's review).
 */
export function joinOpensSpace(status: number | undefined, code: unknown): boolean {
  return status === 409 && code === 'already_member';
}

/** The `errors.code` of a refused join, when the server sent one. */
export function joinErrorCode(body: unknown): unknown {
  if (!body || typeof body !== 'object' || !('errors' in body)) return undefined;
  const errors = (body as { errors: unknown }).errors;
  return errors && typeof errors === 'object' && 'code' in errors ? (errors as { code: unknown }).code : undefined;
}

/**
 * Why a join was refused. A 409 that is not `already_member` says the server's own words, and so does a
 * Space limit (organisation plans: the reader in as many Spaces as their plan allows, or the Space full for
 * its owner's plan), with the way to the plans beside it.
 */
export function joinRefusal(status: number | undefined, hasAccount: boolean, message?: string, limit: SpaceLimit | null = null): Refusal {
  if (limit) return { text: limit.message, offerAccount: false, offerPlans: true };
  if (status === 409) return { text: message?.trim() || "That didn't work. Try again in a moment.", offerAccount: false };
  if (status === 404) return { text: 'This space is no longer public.', offerAccount: false };
  if (status === 403) {
    return hasAccount
      ? { text: "This space doesn't let your account join.", offerAccount: false }
      : { text: 'You need a Lawexa account to join. You can keep reading without one.', offerAccount: true };
  }
  return { text: "That didn't work. Try again in a moment.", offerAccount: false };
}
