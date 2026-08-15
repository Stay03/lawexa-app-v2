import { CachedChannelFrame } from '@/v2/features/channels/screen/CachedChannelFrame';

/**
 * Route-level loading boundary for `/channels/[channelId]`, per the v2
 * loading convention (foundation-standards §8).
 *
 * ONE SILHOUETTE, NOT TWO: this draws the SAME `ChannelScreenFrame` the live
 * screen shows while its detail query resolves — the one header bar, the feed
 * column, the composer — imported from the feature's `states.tsx` so the two
 * can never drift. `still` (no pulse): a route boundary waits on an RSC
 * payload, not a query; the live screen's own pending render pulses.
 *
 * IT GOES THROUGH `CachedChannelFrame`, which fills the bar in from the row the
 * reader tapped when that row is still in the cache. The shape is identical
 * either way — the seeding replaces grey bars with the name and the crest, and
 * moves nothing.
 *
 * `aria-hidden` + `inert` per §8(ii) — a Suspense fallback is DELETED when
 * content arrives, so nothing in it may be focusable or stateful. Exactly
 * one visually-hidden `role="status"` node carries the announcement.
 *
 * The fallback is tab-agnostic by design: `loading.tsx` receives no
 * searchParams, and the header chrome it draws is identical for every `?tab=`
 * destination — only the pane content differs, which the live screen's own
 * three-state regions cover.
 */
export default function Loading() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading this channel
      </span>
      <div aria-hidden inert className="h-full min-h-0">
        <CachedChannelFrame still />
      </div>
    </>
  );
}
