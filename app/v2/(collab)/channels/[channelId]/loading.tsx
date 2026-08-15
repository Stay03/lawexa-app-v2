import { SeededChannelFrame } from '@/v2/features/channels/screen/SeededChannelFrame';

/**
 * Route-level loading boundary for `/channels/[channelId]`, per the v2
 * loading convention (foundation-standards §8).
 *
 * ONE SILHOUETTE, NOT TWO: it draws the SAME `ChannelScreenFrame` the live
 * screen shows while its detail query resolves — identity header row, tab
 * strip, feed column, floating composer pill — so the two can never drift.
 *
 * AND IT KNOWS THE CHANNEL'S NAME. `loading.tsx` receives no route params, so
 * the frame is fed by a client component that reads the uuid from the pathname
 * and the name from the channels list cache. Measured before this landed: this
 * boundary held a NAMELESS frame from 5.2s to 9.6s and the real name did not
 * appear until 28.4s — the owner's "first a complete skeleton no text, then the
 * name with skeleton messages". `SeededChannelFrame` carries the full account.
 *
 * `aria-hidden` + `inert` per §8(ii) — a Suspense fallback is DELETED when
 * content arrives, so nothing in it may be focusable or stateful. Exactly one
 * visually-hidden `role="status"` node carries the announcement, so a screen
 * reader hears "Loading this channel" while a sighted reader sees which one.
 */
export default function Loading() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading this channel
      </span>
      <div aria-hidden inert className="h-full min-h-0">
        <SeededChannelFrame />
      </div>
    </>
  );
}
