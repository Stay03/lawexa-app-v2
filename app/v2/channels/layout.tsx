import { CollabAccessGate } from '@/v2/features/collab/access';

/**
 * v2 `/channels/*` — the segment layout; the same ONE collab audience gate as
 * `/spaces` (phase-5 W1 item 7; owner decision D1, 2026-08-04). See
 * `app/v2/spaces/layout.tsx` for the full reasoning — the two segments share
 * the gate component so the two doors can never drift.
 *
 * ROUTES STAY DARK: both pages now exist — the channel screen
 * (`[channelId]/page.tsx`, W2) and the D6 "My channels" index
 * (`(index)/page.tsx`, W4) — but `/channels` is still deliberately absent from
 * `v2/routes.manifest.ts` until W5, so the clean URLs keep falling through to
 * v1 and these screens are reachable only by a direct `/v2/...` URL in dev.
 *
 * The index lives in an `(index)` route group so its `loading.tsx` cannot
 * become the outer boundary for `[channelId]` and flash a list silhouette over
 * a hard-loaded channel.
 */
export default function V2ChannelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CollabAccessGate>{children}</CollabAccessGate>;
}
