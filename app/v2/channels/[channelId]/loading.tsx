import { ChannelScreenFrame } from '@/v2/features/channels/screen/states';

/**
 * Route-level loading boundary for `/channels/[channelId]`, per the v2
 * loading convention (foundation-standards §8).
 *
 * ONE SILHOUETTE, NOT TWO: this draws the SAME `ChannelScreenFrame` the live
 * screen shows while its detail query resolves — identity header row, tab
 * strip, feed column, floating composer pill — imported from the feature's
 * `states.tsx` so the two can never drift. `still` (no pulse): a route
 * boundary waits on an RSC payload, not a query; the live screen's own
 * pending render pulses.
 *
 * `aria-hidden` + `inert` per §8(ii) — a Suspense fallback is DELETED when
 * content arrives, so nothing in it may be focusable or stateful. Exactly
 * one visually-hidden `role="status"` node carries the announcement.
 *
 * The fallback is tab-agnostic by design: `loading.tsx` receives no
 * searchParams, and the header/tab chrome it draws is identical for every
 * `?tab=` destination — only the pane content differs, which the live
 * screen's own three-state regions cover.
 */
export default function Loading() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading this channel
      </span>
      <div aria-hidden inert className="h-full min-h-0">
        <ChannelScreenFrame still />
      </div>
    </>
  );
}
