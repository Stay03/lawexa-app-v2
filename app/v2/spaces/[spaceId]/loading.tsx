import { SpaceScreenFrame } from '@/v2/features/spaces/detail/states';

/**
 * Route-level loading boundary for `/spaces/[spaceId]`.
 *
 * ONE SILHOUETTE, NOT TWO: it draws the SAME `SpaceScreenFrame` the live
 * screen shows while its detail query resolves — identity header, section
 * heading, channel rows — imported from the feature's `states.tsx` so the two
 * can never drift. `still` (no pulse): a route boundary waits on an RSC
 * payload, not a query; the live screen's own pending render pulses.
 *
 * `aria-hidden` + `inert` per standards §8(ii) — a Suspense fallback is
 * DELETED when content arrives, so nothing in it may be focusable. Exactly one
 * visually-hidden `role="status"` node carries the announcement.
 */
export default function SpaceLoading() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading this space
      </span>
      <div aria-hidden inert>
        <SpaceScreenFrame still />
      </div>
    </>
  );
}
