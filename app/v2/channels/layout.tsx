import { CollabAccessGate } from '@/v2/features/collab/access';

/**
 * v2 `/channels/*` — the segment layout; the same ONE collab audience gate as
 * `/spaces` (phase-5 W1 item 7; owner decision D1, 2026-08-04). See
 * `app/v2/spaces/layout.tsx` for the full reasoning — the two segments share
 * the gate component so the two doors can never drift.
 *
 * ROUTES STAY DARK: `/channels` is deliberately NOT in
 * `v2/routes.manifest.ts` until W5 — the channel screen (`[channelId]`) and
 * the D6 "My channels" index arrive with W2/W4, and until then this segment
 * has no `page.tsx` and is unroutable by design.
 */
export default function V2ChannelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CollabAccessGate>{children}</CollabAccessGate>;
}
