import { CachedSpaceFrame } from '@/v2/features/spaces/detail/CachedSpaceFrame';

/**
 * Route-level loading boundary for `/spaces/[spaceId]`.
 *
 * ONE SILHOUETTE, NOT TWO: it draws the SAME `SpaceScreenFrame` the live
 * screen shows while its detail query resolves — identity block, activity
 * digest, side regions — imported from the feature's `states.tsx` so the two
 * can never drift. The silhouette pulses here just as it does on the live
 * screen (standards §8). One wait may only have one appearance: a reader has
 * no way to tell an RSC payload from a query, and a shape that sits frozen and
 * then starts shimmering reads as the load beginning again.
 *
 * IT GOES THROUGH `CachedSpaceFrame`, which fills the identity block in from
 * the row the reader tapped when that row is still in the cache — the crest,
 * the kicker, the name, the description. The shape is identical either way.
 *
 * IT COVERS THE PANE ONLY. `loading.tsx` wraps the page and everything below
 * it, never the layout above — so the space rail rendered by `(collab)` stays
 * on screen and interactive while this is showing, which is the whole point of
 * the frame.
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
        <CachedSpaceFrame />
      </div>
    </>
  );
}
