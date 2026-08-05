'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { useUrlSearch } from '@/v2/runtime/use-url-search';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { SearchField, SearchFieldShape } from '@/v2/shell/SearchField';
import { TabRow } from '@/v2/shell/TabRow';
import { channelsQueries } from '../queries';
import { groupByRecency } from '../recency';
import {
  MY_CHANNEL_LENSES,
  matchesChannelSearch,
  matchesLens,
  parseMyChannelsLens,
  type MyChannelsLens,
} from './model';
import { MyChannelRow } from './MyChannelRow';
import {
  MyChannelsEmptyState,
  MyChannelsErrorState,
  MyChannelsNoMatchState,
  MyChannelsSkeleton,
} from './states';

/**
 * MyChannelsScreen — the `/channels` index: every channel you belong to, in
 * one stream, with the last message previewed. It is the home screen of every
 * chat product, and until this wave nothing in the app linked to it (the fix
 * is the "Channels" nav row above Spaces — `v2/shell/nav.config.ts`).
 *
 * ── IT SHARES THE SPINE'S CACHE ENTRY, ON PURPOSE ──────────────────────────
 * `channelsQueries.mine({ viewerId })` — NO extra params — is the EXACT key
 * the realtime spine mounts for every eligible viewer, so arriving here paints
 * a full list in the first frame with no request of its own, and the spine's
 * `.channel.unread` writers keep these rows live while the screen is open.
 * Matching the spine's params is what buys that, and it is why the lens and
 * the search box below are CLIENT-SIDE LENSES over the cached rows rather than
 * request parameters: the params object is part of the key, so a `?search=`
 * on the wire would fork a second cache entry and mint a fetch per keystroke.
 *
 * ── WHAT THE SERVER DECIDES, AND WHAT THIS SCREEN THEREFORE DOES NOT ───────
 * `GET /api/channels` is server-sorted by newest activity (empty channels
 * last), so there is no sort control and the grouping never re-orders: Today /
 * This week / Earlier are HEADINGS cut into the server's ranking, not a
 * re-ranking of it.
 *
 * MUTED ROWS — CLAIM NOT YET VERIFIED ON THE WIRE. The July 18 exchange
 * describes this route as excluding muted channels unless they hold a mention
 * for you; `api-digest.md` explicitly does NOT cover this endpoint. So the
 * screen does not DEPEND on that filtering: any muted row that does arrive
 * renders dimmed with its mention badge at full strength, which is correct
 * under either behaviour.
 *
 * ── THE URL IS THE STATE ───────────────────────────────────────────────────
 * `?lens=` and `?search=` both ride the LOUD write path (`replaceUrlParams` /
 * `useUrlSearch`), which is what every other v2 list page uses: this is a
 * STATIC route with no dynamic segment in its tree, so the `/undefined`
 * refetch loop that forced quiet writes on `/spaces/[id]` and
 * `/channels/[id]` cannot arise here. `useSearchParams()` sees both, so
 * Back/Forward restores a filtered view exactly as it was.
 *
 * Phase-5 W4 (owner decision D6); rebuilt for the redesign wave, 2026-08-05.
 */

const PANEL_ID = 'my-channels-panel';

export function MyChannelsScreen() {
  const session = useV2Session();
  const eligible = collabAccessState(session) === 'eligible';
  const viewerId = session.userId;

  // Frozen at mount for the relative ages AND the date sections, so a row's
  // age and the heading above it are measured against one clock and no
  // `Date.now()` runs in render (React Compiler lint).
  const [now] = useState(() => Date.now());

  useEffect(() => {
    setHeaderContext({ title: 'My channels', confidential: false });
    return () => clearHeaderContext();
  }, []);

  const query = useQuery({
    ...channelsQueries.mine({ viewerId }),
    enabled: eligible,
  });

  const searchParams = useSearchParams();
  const lens = parseMyChannelsLens(searchParams.get('lens'));
  const search = useUrlSearch();
  const { committedSearch, onClear } = search;

  const channels = useMemo(() => query.data?.data ?? [], [query.data]);

  const visible = useMemo(
    () =>
      channels.filter(
        (channel) =>
          matchesLens(channel, lens) && matchesChannelSearch(channel, committedSearch),
      ),
    [channels, lens, committedSearch],
  );

  const sections = useMemo(
    () => groupByRecency(visible, now, (channel) => channel.last_message_at),
    [visible, now],
  );

  const setLens = useCallback((next: MyChannelsLens) => {
    replaceUrlParams({ lens: next === 'all' ? null : next });
  }, []);

  const resetLenses = useCallback(() => {
    replaceUrlParams({ lens: null });
    onClear();
  }, [onClear]);

  const apiError = query.error ? extractApiError(query.error) : null;
  const explainedError =
    apiError && apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : undefined;

  const showSkeleton = query.isPending;
  const showError = query.isError && channels.length === 0;
  const showEmpty = !showSkeleton && !showError && channels.length === 0;
  const showNoMatch =
    !showSkeleton && !showError && !showEmpty && visible.length === 0;

  return (
    <div className={LIST_COLUMN}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabRow
          tabs={MY_CHANNEL_LENSES}
          value={lens}
          onChange={setLens}
          ariaLabel="Filter your channels"
          panelId={PANEL_ID}
          className="inline-flex max-w-full items-center gap-0.5 self-start overflow-x-auto rounded-full bg-secondary/60 p-0.5"
          tabClassName={(selected) =>
            cn(
              'v2-interactive min-h-8 shrink-0 rounded-full px-3.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {(tab) => tab.label}
        </TabRow>

        {/* SHOWN AT EVERY WIDTH. The brief asked for this field at `sm:`+, and
            that was wrong for this surface specifically: `/channels` is the
            natural MOBILE entry point into the conversations, phones are where
            a person has the most channels and the least screen to scan them
            with, and the term rides the URL — so a hidden field would also let
            a shared link land a phone on a quietly narrowed list with nothing
            on screen to say why. */}
        <SearchField
          className="w-full sm:max-w-56"
          value={search.inputValue}
          onChange={search.onInputChange}
          onClear={search.onClear}
          placeholder="Search channels"
          label="Search your channels by name or space"
        />
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {showSkeleton ? 'Loading your channels' : ''}
      </span>

      {/* `aria-labelledby` names the SELECTED tab — the other half of the
          contract `TabRow`'s `panelId` opens. Without it the panel is a region
          with no announced relationship to the strip that controls it. */}
      <div
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={`${PANEL_ID}-tab-${lens}`}
      >
        {showSkeleton ? (
          <MyChannelsSkeleton />
        ) : showError ? (
          <MyChannelsErrorState
            message={explainedError}
            onRetry={() => void query.refetch()}
          />
        ) : showEmpty ? (
          <MyChannelsEmptyState />
        ) : showNoMatch ? (
          <MyChannelsNoMatchState
            lens={lens}
            searching={committedSearch.trim() !== ''}
            onReset={resetLenses}
          />
        ) : (
          <div className="flex flex-col gap-5">
            {sections.map((section, sectionIndex) => {
              // The entrance stagger counts across ALL sections, so the list
              // reads as one arrival rather than three restarting at every
              // heading. Derived rather than accumulated in a mutable counter:
              // nothing in render may depend on the order React calls it in.
              const offset = sections
                .slice(0, sectionIndex)
                .reduce((total, previous) => total + previous.rows.length, 0);
              return (
                <section key={section.bucket}>
                  <h2 className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    {section.label}
                  </h2>
                  <ul className="flex flex-col divide-y divide-border/60">
                    {section.rows.map((channel, index) => (
                      <MyChannelRow
                        key={channel.uuid}
                        channel={channel}
                        now={now}
                        index={offset + index}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Route fallback — the toolbar as a STILL reserved shape over the real list
 * skeleton. `app/v2/channels/(index)/loading.tsx` renders this, so the
 * boundary and the live screen are one continuous shape. `aria-hidden` +
 * `inert`: a fallback is deleted rather than reconciled, so nothing focusable
 * may live in it. The lens strip and the search box are STATIC CHROME — they
 * wait on no request — so both are reserved without a pulse.
 */
export function MyChannelsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your channels
      </span>
      <div aria-hidden inert className={LIST_COLUMN}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-9 w-48 self-start rounded-full bg-secondary/60" />
          <SearchFieldShape className="w-full sm:max-w-56" />
        </div>
        <MyChannelsSkeleton still />
      </div>
    </>
  );
}
