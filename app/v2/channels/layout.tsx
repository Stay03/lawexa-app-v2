import { CollabAccessGate } from '@/v2/features/collab/access';

/**
 * v2 `/channels/*` — the segment layout; the same ONE collab audience gate as
 * `/spaces` (phase-5 W1 item 7; owner decision D1, 2026-08-04). See
 * `app/v2/spaces/layout.tsx` for the full reasoning — the two segments share
 * the gate component so the two doors can never drift.
 *
 * LIVE SINCE W5: `/channels/*` is in `v2/routes.manifest.ts`, which is what
 * makes both the mention toast's and the push notification's
 * `/channels/{uuid}?m={message}` deep link land on the v2 channel screen for
 * an opted-in reader.
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
