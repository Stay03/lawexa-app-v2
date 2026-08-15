'use client';

import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

import { findCachedRow } from '@/v2/runtime/seed-detail';
import type { Channel } from '@/types/collab';
import { channelsQueries } from '../queries';
import { ChannelScreenFrame } from './states';

/**
 * SeededChannelFrame — the channel's loading frame, wearing the name of the
 * channel the reader actually tapped.
 *
 * ── THE COMPLAINT, AND WHY THE OBVIOUS FIX MISSES IT ───────────────────────
 * Owner, 15 August 2026: "For channel, the first is a complete skeleton no
 * text, the second has the name of the channel on the header but skeleton on
 * the messages."
 *
 * Measured on a throttled connection: the nameless stage ran from 5.2s to
 * 9.6s, and the named one did not arrive until 28.4s. Nineteen seconds of a
 * channel that would not say which channel it was.
 *
 * The obvious fix is to seed the SCREEN's query from the list cache. It does
 * not help here, and measuring is what showed why: the route boundary owns the
 * whole of that nineteen seconds and the screen has not mounted yet, so there
 * is nothing on the screen side to seed. **The boundary is where the time is,
 * so the boundary is what has to know the name.**
 *
 * ── A `loading.tsx` GETS NO PARAMS, BUT A CLIENT COMPONENT HAS A URL ───────
 * Next hands `loading.tsx` no route params, which is why this could not be
 * done from the boundary file itself. A CLIENT component inside it can read
 * `usePathname()` — already reporting the destination, since the App Router
 * updates it at navigation start — and take the uuid from there. The same
 * trick `DestinationFallback` uses, for the same reason.
 *
 * From the uuid the name comes out of the channels list cache, which is
 * populated precisely because the reader was just looking at that list. A cold
 * arrival — a shared link, a notification, a refresh — finds nothing and gets
 * the silhouette bar it always had. That is the correct answer for a reader
 * who genuinely has not seen this channel's name yet.
 *
 * ── IT IS A NAME, NOT A PAYLOAD ────────────────────────────────────────────
 * Only the name is taken. The list row also holds counts and a description,
 * and none of them are drawn here: a count that is one navigation stale is a
 * wrong number rendered as fact, whereas a name is the one field that cannot
 * have changed between the tap and the paint without the reader knowing.
 */
export function SeededChannelFrame() {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  // `/channels/{uuid}` and its `/v2` twin both reach here through the proxy.
  const uuid = pathname.split('/').filter(Boolean).pop() ?? '';

  // `lists()` is the PREFIX, so this matches every cached variant of the
  // channels list — search results, later pages, each viewer partition — not
  // just the one the reader happened to be on.
  const row = uuid
    ? findCachedRow<Channel>(
        queryClient,
        channelsQueries.lists(),
        (candidate) => candidate.uuid === uuid,
      )
    : undefined;

  return <ChannelScreenFrame still name={row?.name ?? null} />;
}
