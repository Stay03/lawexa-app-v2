'use client';

import { usePathname } from 'next/navigation';

import { parseCollabRoute } from '@/v2/features/collab/shell/collab-route';
import { useV2Session } from '@/v2/runtime/session-context';
import { defaultSpaceTab, spaceShowsChannels } from '../model';
import { useCachedSpaceIdentity } from './cached-identity';
import { SpaceScreenFrame } from './states';

/**
 * The space lobby's frame, filled in from the row the reader tapped. The
 * reasoning is in {@link useCachedSpaceIdentity}; this is only the wiring, and
 * it reads the uuid off `usePathname()` because `loading.tsx` is handed no
 * params (see `CachedChannelFrame` for why that is the right source).
 *
 * WHICH PANEL IT DRAWS (Spaces F2, 11 October 2026): the panel of the tab the
 * page opens on by default, which depends on whether the space shows its
 * channels to this viewer. Below researcher that is known at once (never); for
 * a researcher it is the cached row's kind, and on a cold arrival with no row
 * it is the lobby, because every space that predates shared ones is a team
 * space. It does not read `?tab=`: asking for the search params here would
 * suspend the fallback itself.
 */
export function CachedSpaceFrame() {
  const route = parseCollabRoute(usePathname() ?? '');
  const uuid = route.kind === 'space' ? route.spaceUuid : null;
  const identity = useCachedSpaceIdentity(uuid);
  const session = useV2Session();
  const showsChannels = spaceShowsChannels(
    { kind: identity?.kind ?? 'team' },
    session,
  );
  return (
    <SpaceScreenFrame
      identity={identity}
      showsChannels={showsChannels}
      tab={defaultSpaceTab(showsChannels)}
    />
  );
}
