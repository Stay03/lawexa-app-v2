import type { InviteAcceptResult, InviteViewerAction } from '@/types/collab';
import { spaceGameHref } from '@/lib/utils/space-game-href';

/**
 * Every Space query's key starts here (v2's `spacesQueries.all`; this screen
 * is outside v2 and may not import it, so a test holds the two equal). The
 * join reads them all again, so the Space opens as a member's.
 */
export const SPACES_QUERY_ROOT = ['spaces'] as const;

/**
 * join-model — the join screen's pure rules: where a join lands and what its
 * one button says, for an ordinary invite and for a live quiz's game link
 * (Backend's shapes 7a007a8c: the preview names the `game`, and accept
 * answers its `game_uuid`).
 */

/** Where an accepted invite lands: in the game for a game link, else the channel or the Space. */
export function joinedDestination(result: Pick<InviteAcceptResult, 'space_uuid' | 'channel_uuid' | 'game_uuid'>): string {
  if (result.game_uuid) return spaceGameHref(result.space_uuid, result.game_uuid);
  if (result.channel_uuid) return `/channels/${result.channel_uuid}`;
  return `/spaces/${result.space_uuid}`;
}

const ACTION_LABEL: Record<InviteViewerAction, string> = {
  sign_up: 'Sign in to join',
  verify_email: 'Confirm your email to join',
  join: 'Join',
  request: 'Ask to join',
  already_member: 'Open the space',
};

/** A game link says where its button goes: into the game. */
const GAME_ACTION_LABEL: Record<InviteViewerAction, string> = {
  ...ACTION_LABEL,
  join: 'Join the game',
  already_member: 'Open the game',
};

/** The one control, per the server's answer about this viewer. */
export function joinActionLabel(action: InviteViewerAction, isGameLink: boolean): string {
  return (isGameLink ? GAME_ACTION_LABEL : ACTION_LABEL)[action];
}

/**
 * The invite code from the `/join/{code}` route, decoded once.
 *
 * Next hands the route's value over still percent-encoded in one place and
 * decoded in another (seen 14 November 2026: the page's preview fetch sent
 * `%2520` where the screen sent `%20`). Read once here, it is the same string
 * in both, and every request encodes it once as a single path segment. A value
 * that is not valid percent-encoding is taken as it came.
 */
export function readInviteCode(routeValue: string): string {
  try {
    return decodeURIComponent(routeValue);
  } catch {
    return routeValue;
  }
}

/**
 * An invite code's alphabet: the server's pool, which leaves out 0, 1, l and O
 * (Backend's InviteLinkCodeGenerator::POOL, 14 November 2026). Today every
 * code is 16 of them; the range below leaves room for the generator to grow
 * its codes, so a longer code still reaches the server rather than reading as
 * a link that does not exist.
 */
const INVITE_CODE_POOL = '2-9a-km-zA-NP-Z';
const INVITE_CODE_MIN = 8;
const INVITE_CODE_MAX = 64;
const INVITE_CODE = new RegExp(`^[${INVITE_CODE_POOL}]{${INVITE_CODE_MIN},${INVITE_CODE_MAX}}$`);

/**
 * Whether the route's value can be an invite code at all. One that cannot, a
 * link with the share message glued on for one (Arthur's live quiz test, 14
 * November 2026), does not exist: the screen says so without asking, rather
 * than leaving the answer to a request that may fail on the way.
 */
export function isInviteCode(code: string): boolean {
  return INVITE_CODE.test(code);
}
