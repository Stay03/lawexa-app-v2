'use client';

import { usePathname } from 'next/navigation';

import { parseCollabRoute } from '@/v2/features/collab/shell/collab-route';
import { defaultSpaceTab } from '../model';
import { useCachedSpaceIdentity } from './cached-identity';
import { SpaceScreenFrame } from './states';

/**
 * The space lobby's frame, filled in from the row the reader tapped. The
 * reasoning is in {@link useCachedSpaceIdentity}; this is only the wiring, and
 * it reads the uuid off `usePathname()` because `loading.tsx` is handed no
 * params (see `CachedChannelFrame` for why that is the right source).
 *
 * WHICH PANEL IT DRAWS: the list of the pill a bare address opens on (All).
 * It does not read `?tab=`: asking for the search params here would suspend
 * the fallback itself.
 */
export function CachedSpaceFrame() {
  const route = parseCollabRoute(usePathname() ?? '');
  const uuid = route.kind === 'space' ? route.spaceUuid : null;
  const identity = useCachedSpaceIdentity(uuid);
  return <SpaceScreenFrame identity={identity} tab={defaultSpaceTab()} />;
}
