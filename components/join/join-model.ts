import type { InviteAcceptResult, InviteViewerAction } from '@/types/collab';
import { spaceGameHref } from '@/lib/utils/space-game-href';

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
