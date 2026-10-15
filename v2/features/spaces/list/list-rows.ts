import type { Space } from '@/types/collab';
import { isMembershipOwner } from '../model';

/**
 * The spaces list in two sections (Stay, 15 October 2026: "there should also
 * be a way to indicate my spaces from spaces i joined"): the spaces the reader
 * owns, then the ones they joined. Each keeps the server's order, which is the
 * most recent activity first (backend's default since the same day), so the
 * space used last sits at the top of its section.
 */
export function spaceListSections(spaces: readonly Space[]): { mine: Space[]; joined: Space[] } {
  const mine: Space[] = [];
  const joined: Space[] = [];
  for (const space of spaces) (isMembershipOwner(space) ? mine : joined).push(space);
  return { mine, joined };
}

/** Private or public, for the row's word. Read off `is_private` alone: a
 *  shared space may be public since public shared spaces (15 October 2026). */
export function spaceIsPrivate(space: Pick<Space, 'kind' | 'is_private'>): boolean {
  return space.is_private;
}
