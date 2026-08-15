'use client';

import { usePathname } from 'next/navigation';

import { parseCollabRoute } from '@/v2/features/collab/shell/collab-route';
import { useCachedSpaceIdentity } from './cached-identity';
import { SpaceScreenFrame } from './states';

/**
 * The space lobby's frame, filled in from the row the reader tapped. The
 * reasoning is in {@link useCachedSpaceIdentity}; this is only the wiring, and
 * it reads the uuid off `usePathname()` because `loading.tsx` is handed no
 * params (see `CachedChannelFrame` for why that is the right source).
 */
export function CachedSpaceFrame({ still = false }: { still?: boolean }) {
  const route = parseCollabRoute(usePathname() ?? '');
  const uuid = route.kind === 'space' ? route.spaceUuid : null;
  const identity = useCachedSpaceIdentity(uuid);
  return <SpaceScreenFrame still={still} identity={identity} />;
}
