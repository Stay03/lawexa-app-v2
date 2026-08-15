'use client';

import { usePathname } from 'next/navigation';

import { parseCollabRoute } from '@/v2/features/collab/shell/collab-route';
import { useCachedChannelIdentity } from './cached-identity';
import { ChannelScreenFrame } from './states';

/**
 * The channel frame, filled in from the row the reader tapped. The reasoning is
 * in {@link useCachedChannelIdentity}; this is only the wiring.
 *
 * ── WHY THE UUID COMES FROM THE PATHNAME ───────────────────────────────────
 * `loading.tsx` is handed no params, and this renders inside it.
 * `usePathname()` reports the DESTINATION from the start of a soft navigation,
 * which is exactly the address whose frame is being drawn, and it is SSR-safe —
 * `window.location` is neither.
 */
export function CachedChannelFrame() {
  const route = parseCollabRoute(usePathname() ?? '');
  const uuid = route.kind === 'channel' ? route.channelUuid : null;
  const identity = useCachedChannelIdentity(uuid);
  return <ChannelScreenFrame identity={identity} />;
}
