'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Boxes } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { channelsQueries } from '../queries';
import { MyChannelRow } from './MyChannelRow';
import {
  MyChannelsEmptyState,
  MyChannelsErrorState,
  MyChannelsSkeleton,
} from './states';

/**
 * MyChannelsScreen — the `/channels` index (owner decision D6: the API existed,
 * the home's "Jump back in" already used it, and the bare URL 404'd; a real
 * index is one query away and is the natural mobile entry point).
 *
 * ── IT SHARES THE SPINE'S CACHE ENTRY, ON PURPOSE ──────────────────────────
 * `channelsQueries.mine({ viewerId })` is the EXACT key the realtime spine
 * already mounts for every eligible viewer, so arriving here paints a full
 * list in the first frame with no request of its own, and the spine's
 * `.channel.unread` writers keep these rows' counts live while the screen is
 * open (the owner feel directive: fluidity is cache-first paints). Matching
 * the spine's params is what buys that — a different `per_page` would silently
 * fork a second cache entry and a second request.
 *
 * ── WHAT THE SERVER DECIDES, AND WHAT THIS SCREEN THEREFORE DOES NOT ───────
 * `GET /api/channels` is server-sorted by newest activity (empty channels
 * last), so there is no sort control here: re-ordering rows the server ranked
 * would be this screen arguing with the contract.
 *
 * MUTED ROWS — CLAIM NOT YET VERIFIED ON THE WIRE. The July 18 exchange
 * describes this route as excluding muted channels unless they hold a mention
 * for you; `api-digest.md` explicitly does NOT cover this endpoint (its
 * baseline note says the cross-space list's contract lives outside the digest's
 * sources). So the screen does not DEPEND on that filtering: any muted row that
 * does arrive renders dimmed with its mention badge at full strength, which is
 * correct under either behaviour. Confirm on the wire in W5's device pass.
 *
 * Phase-5 W4; relocated out of `features/spaces/` into its own feature by W5
 * (W4 built it under spaces only because the channels folder belonged to a
 * parallel wave — that constraint is gone). 2026-08-04.
 */

export function MyChannelsScreen() {
  const session = useV2Session();
  const eligible = collabAccessState(session) === 'eligible';
  const viewerId = session.userId;

  // Frozen at mount for the relative ages — the list refetches on arrival, so
  // clock and data move together and no `Date.now()` runs in render.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    setHeaderContext({ title: 'My channels', confidential: false });
    return () => clearHeaderContext();
  }, []);

  const query = useQuery({
    ...channelsQueries.mine({ viewerId }),
    enabled: eligible,
  });

  const channels = query.data?.data ?? [];

  const apiError = query.error ? extractApiError(query.error) : null;
  const explainedError =
    apiError && apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : undefined;

  const showSkeleton = query.isPending;
  const showError = query.isError && channels.length === 0;
  const showEmpty = !showSkeleton && !showError && channels.length === 0;

  return (
    <div className={LIST_COLUMN}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Every channel you belong to, newest activity first.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/spaces">
            <Boxes aria-hidden className="size-4" />
            Spaces
          </Link>
        </Button>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {showSkeleton ? 'Loading your channels' : ''}
      </span>

      {showSkeleton ? (
        <MyChannelsSkeleton />
      ) : showError ? (
        <MyChannelsErrorState
          message={explainedError}
          onRetry={() => void query.refetch()}
        />
      ) : showEmpty ? (
        <MyChannelsEmptyState />
      ) : (
        <ul className="flex flex-col divide-y divide-border/60">
          {channels.map((channel, index) => (
            <MyChannelRow
              key={channel.uuid}
              channel={channel}
              now={now}
              index={index}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Route fallback — the toolbar as a STILL reserved shape over the real list
 * skeleton. `app/v2/channels/loading.tsx` renders this, so the boundary and
 * the live screen are one continuous shape. `aria-hidden` + `inert`: a
 * fallback is deleted rather than reconciled, so nothing focusable may live
 * in it.
 */
export function MyChannelsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your channels
      </span>
      <div aria-hidden inert className={LIST_COLUMN}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="h-4 w-56 max-w-[60%] rounded bg-secondary/60" />
          <div className="h-8 w-24 rounded-md bg-secondary/60" />
        </div>
        <MyChannelsSkeleton still />
      </div>
    </>
  );
}
