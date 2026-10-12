import type { QueryClient } from '@tanstack/react-query';

import { isGoneMark } from './conversation/gone-marks';
import { isConfidentialMark } from './conversation/mode-marks';
import { conversationsQueries, VISIT_CHECK_WINDOW_MS } from './queries';

/**
 * warmConversation — start the conversation's read in the tap on its link, so
 * the transcript is in the cache when the screen mounts.
 *
 * ── WHY ────────────────────────────────────────────────────────────────────
 * On a first open the screen mounts 2.1 to 2.5 s after the tap, behind the
 * route payload and its code, and only then asked for the transcript, which
 * the server answers in about 0.3 s (trace, 9 October 2026). Started in the
 * tap, the read runs while the route loads; the screen's first render finds
 * the record, the engine is seeded with it, and no skeleton shows.
 *
 * ── ONE READ PER OPEN ──────────────────────────────────────────────────────
 * The same leaf as the screen (`conversationsQueries.detail`, the same key and
 * viewer partition), so the screen's mount joins this read while it runs and
 * skips its own once it has landed (`checkOnArrival` in queries.ts). The
 * `staleTime` override makes this the arrival's check: a chat read within the
 * window sends nothing, an older copy is re-read at the tap instead of at mount.
 * A double tap gets the running promise back.
 *
 * ── ON THE CLICK, NOT THE POINTERDOWN ──────────────────────────────────────
 * Every read logs a ConversationViewed row on the server (techlead, 9 October
 * 2026). A finger that lands on a row to scroll the list fires pointerdown and
 * no click, so a read there, or on hover, would log views nobody made. The
 * click is also where the move-first provider pushes the chat's history entry,
 * and the read starts after that push: a 401 that lands later then sees
 * `/c/...` and does not send the reader to /login from the list
 * (lib/api/client.ts), exactly as the screen's own read does.
 *
 * ── NOT CANCELLED ──────────────────────────────────────────────────────────
 * A back during the tap leaves the read to land. The fetcher takes no abort
 * signal, so a cancel would not stop the request; the answer is kept 30 min in
 * memory and on the device, so a forward or a later tap paints at once. The
 * cost is one view logged for a chat the reader backed out of.
 *
 * ── SKIPPED ────────────────────────────────────────────────────────────────
 * A confidential chat (the link's flag or this device's mark: the server 404s
 * it and nothing of it may be cached), and a chat the server dropped this visit
 * (gone mark: the screen shows "not available" without reading).
 *
 * No performance switch: the `read` switch's approved words promise a case
 * prefetch that counts no view, and this read counts one. Its timing control is
 * the build without it.
 */
export function warmConversation(
  queryClient: QueryClient,
  {
    conversationId,
    viewerId,
    confidential = false,
  }: {
    conversationId: string;
    /** The server-verified viewer id (`useV2Session().userId`): the screen's partition. */
    viewerId: number | null;
    /** The link's own confidential flag. */
    confidential?: boolean;
  },
): void {
  if (confidential || isConfidentialMark(conversationId) || isGoneMark(conversationId)) return;
  // `prefetchQuery` swallows its own errors: the screen reads for itself and
  // shows the failure there.
  void queryClient.prefetchQuery({
    ...conversationsQueries.detail({ conversationId, viewerId }),
    staleTime: VISIT_CHECK_WINDOW_MS,
  });
}

/** The conversation a chat href opens (`/c/{id}`), or `null` for any other href. */
export function conversationIdOf(href: string): string | null {
  const match = /^\/c\/([^/?#]+)/.exec(href);
  return match ? decodeURIComponent(match[1]) : null;
}
