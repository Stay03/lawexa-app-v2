'use client';

import { usePathname } from 'next/navigation';

import { canOpenTeamChannels } from '@/v2/features/collab/model';
import { parseCollabRoute } from '@/v2/features/collab/shell/collab-route';
import { useV2Session } from '@/v2/runtime/session-context';
import { useCachedSpaceIdentity } from './cached-identity';
import { SpaceScreenFrame } from './states';

/**
 * The space lobby's frame, filled in from the row the reader tapped. The
 * reasoning is in {@link useCachedSpaceIdentity}; this is only the wiring, and
 * it reads the uuid off `usePathname()` because `loading.tsx` is handed no
 * params (see `CachedChannelFrame` for why that is the right source).
 *
 * Without Team Channels the lobby has no channel digest (Spaces F1, 12
 * October 2026), so neither does its silhouette; the session says which.
 */
export function CachedSpaceFrame() {
  const route = parseCollabRoute(usePathname() ?? '');
  const uuid = route.kind === 'space' ? route.spaceUuid : null;
  const identity = useCachedSpaceIdentity(uuid);
  const showsChannels = canOpenTeamChannels(useV2Session());
  return <SpaceScreenFrame identity={identity} showsChannels={showsChannels} />;
}
