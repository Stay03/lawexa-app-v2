'use client';

import { useQueryClient } from '@tanstack/react-query';

import type { Space } from '@/types/collab';
import { findCachedRow } from '@/v2/runtime/seed-detail';
import { spaceOwnerLabel } from '../model';
import { spacesQueries } from '../queries';
import type { SpaceFrameIdentity } from './states';

/**
 * The identity of a space that is already in some cached list, or `null`.
 *
 * The channel side of this is `v2/features/channels/screen/cached-identity` and
 * the reasoning is written out there: only settled facts are taken, never a
 * ruling, and a cold arrival keeps the silhouette it always had.
 *
 * WHAT A SPACE ROW KNOWS is more than a channel row does — the crest, the
 * kicker, the name, whether it is private, and the description are all on it
 * (measured against `GET /spaces/{uuid}` on 15 August 2026: the detail adds
 * only `creator` and `members`). So the lobby's whole identity block can paint
 * from the first frame, and only the digest and the roster resolve later.
 */
export function useCachedSpaceIdentity(
  uuid: string | null,
): SpaceFrameIdentity | null {
  const queryClient = useQueryClient();
  if (uuid === null) return null;
  const row = findCachedRow<Space>(
    queryClient,
    spacesQueries.lists(),
    (candidate) => candidate.uuid === uuid,
  );
  if (!row) return null;
  return {
    uuid: row.uuid,
    name: row.name,
    type: row.type,
    typeLabel: row.type_label,
    // The same derivation the live header runs, so the kicker cannot read
    // "Personal" in the frame and name an organisation a paint later.
    ownerLabel: spaceOwnerLabel(row),
    isPrivate: row.is_private,
    description: row.description?.trim() || null,
  };
}
