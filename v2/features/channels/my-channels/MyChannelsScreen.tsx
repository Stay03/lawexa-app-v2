'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { extractApiError } from '@/lib/utils/api-error';
import { collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { useUrlSearch } from '@/v2/runtime/use-url-search';
import { useSearchPosition } from '@/v2/search-position';
import { LIST_COLUMN_DOCKED } from '@/v2/shell/page-columns';
import { ScreenDock, ScreenDockSearch } from '@/v2/shell/ScreenDock';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import { SearchField, SearchFieldShape } from '@/v2/shell/SearchField';
import { TabRow } from '@/v2/shell/TabRow';
import { channelsQueries } from '../queries';
import { groupByRecency } from '../recency';
import {
  MY_CHANNEL_LENSES,
  NO_MY_THREADS,
  matchesChannelSearch,
  matchesLens,
  groupMyRooms,
  parseMyChannelsLens,
  type MyChannelsLens,
} from './model';
import { MyChannelGroupRows } from './MyChannelGroupRows';
import {
  MyChannelsEmptyState,
  MyChannelsErrorState,
  MyChannelsNoMatchState,
  MyChannelsSkeleton,
} from './states';

/**
 * MyChannelsScreen — the `/channels` index: every channel and thread you belong
 * to, in one stream, newest first. It is the home screen of every chat product,
 * and until this wave nothing in the app linked to it (the fix is the "Channels"
 * nav row above Spaces — `v2/shell/nav.config.ts`).
 *
 * ── IT SHARES THE SPINE'S CACHE ENTRY, ON PURPOSE ──────────────────────────
 * `channelsQueries.mine({ viewerId })` — NO extra params — is the EXACT key
 * the realtime spine mounts for every eligible viewer, so arriving here paints
 * the channel rows in the first frame from a cache somebody else filled, and the
 * spine's `.channel.unread` writers keep them live while the screen is open.
 * Matching the spine's params is what buys that, and it is why the lens and
 * the search box below are CLIENT-SIDE LENSES over the cached rows rather than
 * request parameters: the params object is part of the key, so a `?search=`
 * on the wire would fork a second cache entry and mint a fetch per keystroke.
 *
 * The THREAD half below is this screen's own request, the one thing here that is
 * not free, and the gates further down are shaped around protecting that first
 * frame from it. Its rows get the same live writers regardless: `myThreads` is
 * keyed under the same `lists()` prefix the `.channel.unread` fan-out walks.
 *
 * ── THREADS ARE IN THIS LIST TOO (2026-08-16) ──────────────────────────────
 * `GET /api/channels` applies `topLevel()` and returns channels only, so a
 * reader tagged in a THREAD opened "My channels", met a screen of channels with
 * previews, and could not see the thread that tagged them anywhere. That is the
 * hole the space lobby had, reported again here with a screenshot. The fix is
 * the same fix: `GET /threads`, the cross-space twin of that listing, read
 * through `channelsQueries.myThreads` and merged into ONE ranked list by
 * `mergeMyRooms`, so the thread that lit the badge can be row one.
 *
 * A thread joins the SAME date sections as a channel and is NOT given a section
 * of its own. A heading called "Threads" would sort a triage list by kind, and
 * kind is the one thing the reader is not triaging by: they are looking for
 * what is new, and a thread is new in exactly the way a channel is.
 *
 * ── WHAT THE SERVER DECIDES, AND WHAT THIS SCREEN THEREFORE DOES NOT ───────
 * Both routes are server-sorted by newest activity, and the screen used to lean
 * on that entirely: Today / This week / Earlier were HEADINGS cut into the
 * server's ranking with no client sort at all. Merging a second ranked list ends
 * that, because two lists each sorted by newest activity are not one list sorted
 * by newest activity. So the merge now ranks, on the same
 * `last_message_at ?? created_at` clock both thread routes order by
 * (`roomActivityAt`), and the headings are cut into THAT. There is still no sort
 * control: there is one order, and it is the server's rule applied to both
 * halves.
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

  // WHERE the field is drawn — the developer switch (`v2/search-position.ts`).
  const searchAtTop = useSearchPosition() === 'top';

  const query = useQuery({
    ...channelsQueries.mine({ viewerId }),
    enabled: eligible,
  });

  /**
   * The thread half. CALLED BARE, exactly as `mine` is, and for two reasons.
   * The params object is part of the key, so a bare call is the entry any other
   * consumer would reach for by default (the nav signal already does that with
   * `mine`), and a spelt-out page size here would quietly fork a second entry
   * the day one of them wants it. It also lands both halves on the same DEPTH:
   * `getMyThreads` and `getMine` both default to 20 per page, so the merged list
   * is cut off at one place rather than showing month-old threads beside
   * channels that fell off a shorter page.
   *
   * Gated on `eligible` like its twin: an unverified or out-of-audience
   * account's collab reads are refused at the door, so the request is not worth
   * spending.
   */
  const threadsQuery = useQuery({
    ...channelsQueries.myThreads({ viewerId }),
    enabled: eligible,
  });

  const searchParams = useSearchParams();
  const lens = parseMyChannelsLens(searchParams.get('lens'));
  const search = useUrlSearch();
  const { committedSearch, onClear } = search;

  const channels = useMemo(() => query.data?.data ?? [], [query.data]);
  /* The frozen empty default while the threads list is pending, refused or
     ungated: a fresh `[]` would give the merge memo below a new dependency on
     every render and re-rank the whole list for nothing. */
  const threads = threadsQuery.data?.data ?? NO_MY_THREADS;

  /* FILTERED IN TWO HALVES, THEN GROUPED — not merged, filtered and regrouped.
     A lens or a search term has to narrow channels and threads separately,
     because the two are no longer peers: a thread that matches while its
     channel does not still needs somewhere to sit. `groupMyRooms` builds it a
     heading from the parent name the thread already carries, so searching
     "websocket" shows the matching thread under a Product Development heading
     rather than losing it or promoting it to a top-level row. */
  const visibleChannels = useMemo(
    () =>
      channels.filter(
        (room) => matchesLens(room, lens) && matchesChannelSearch(room, committedSearch),
      ),
    [channels, lens, committedSearch],
  );

  const visibleThreads = useMemo(
    () =>
      threads.filter(
        (room) => matchesLens(room, lens) && matchesChannelSearch(room, committedSearch),
      ),
    [threads, lens, committedSearch],
  );

  const groups = useMemo(
    () => groupMyRooms(visibleChannels, visibleThreads),
    [visibleChannels, visibleThreads],
  );

  /* The date headings survive the regrouping and now bucket HEADINGS rather
     than rows, on the group's own clock — the newest of a channel and anything
     under it. Bucketing on the channel's own `last_message_at` would file
     Product Development under "Earlier" while the thread drawn inside it moved
     a minute ago, which is the same lie the ranking fix exists to stop. */
  const sections = useMemo(
    () => groupByRecency(groups, now, (group) => group.activityAt),
    [groups, now],
  );

  const setLens = useCallback((next: MyChannelsLens) => {
    replaceUrlParams({ lens: next === 'all' ? null : next });
  }, []);

  const resetLenses = useCallback(() => {
    replaceUrlParams({ lens: null });
    onClear();
  }, [onClear]);

  /* One list, one "try again": the panel says it about the list, and the list
     now has two halves. The two `refetch`s are read off the results first
     because a query result object is a new reference on every render, so
     depending on the results themselves would rebuild this callback each time. */
  const refetchChannels = query.refetch;
  const refetchThreads = threadsQuery.refetch;
  const retry = useCallback(() => {
    void refetchChannels();
    void refetchThreads();
  }, [refetchChannels, refetchThreads]);

  const failure = query.error ?? threadsQuery.error;
  const apiError = failure ? extractApiError(failure) : null;
  const explainedError =
    apiError && apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : undefined;

  /**
   * ── THE GATES ARE ASYMMETRIC, ON PURPOSE ──────────────────────────────────
   * The channel half is the one the spine keeps warm, so it decides the
   * skeleton: waiting for the thread half as well would trade this screen's one
   * prized property (arriving paints a full list in the FIRST FRAME, from a
   * cache somebody else filled) for a cold skeleton on every first visit, since
   * nothing mounts `myThreads` app-wide. Thread rows are additive, and they
   * arrive with the list's own fade rather than replacing anything.
   *
   * The one case where the thread half does hold the paint is when there are no
   * channels at all: claiming "No channels yet" while `/threads` is still in
   * flight would flash an empty state at a reader who has threads, and an empty
   * state that is then contradicted is worse than a beat of skeleton.
   *
   * EMPTINESS AND FAILURE BOTH COUNT BOTH HALVES. Guarding either on the
   * channels alone would blank real thread rows behind a panel - the exact
   * mistake that put this screen in a screenshot.
   */
  const nothingKnown = channels.length === 0 && threads.length === 0;
  const showSkeleton = query.isPending || (nothingKnown && threadsQuery.isPending);
  const showError = (query.isError || threadsQuery.isError) && nothingKnown;
  const showEmpty = !showSkeleton && !showError && nothingKnown;
  const showNoMatch =
    !showSkeleton && !showError && !showEmpty && groups.length === 0;

  // SHOWN AT EVERY WIDTH. The brief asked for this field at `sm:`+, and that
  // was wrong for this surface specifically: `/channels` is the natural MOBILE
  // entry point into the conversations, phones are where a person has the most
  // channels and the least screen to scan them with, and the term rides the URL
  // — so a hidden field would also let a shared link land a phone on a quietly
  // narrowed list with nothing on screen to say why.
  //
  // Built ONCE and rendered in whichever position the developer switch names,
  // so the two placements cannot drift in placeholder or label.
  const searchField = (
    <SearchField
      value={search.inputValue}
      onChange={search.onInputChange}
      onClear={search.onClear}
      placeholder="Search channels"
      // The PLACEHOLDER stays as it was and the LABEL widens. Threads are in
      // this list, but a thread IS a channel in this product's own vocabulary
      // (which is why `channelDisplayName` exists at all), so "Search channels"
      // promises nothing it does not deliver - while a longer placeholder would
      // truncate in the narrow top position and say less, not more. The label is
      // where the full scope belongs: it is read out, never clipped.
      label="Search your channels and threads by name, space or parent channel"
    />
  );

  return (
    <div className={LIST_COLUMN_DOCKED}>
      <ScreenTitle />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabRow
          tabs={MY_CHANNEL_LENSES}
          value={lens}
          onChange={setLens}
          ariaLabel="Filter your channels"
          panelId={PANEL_ID}
          className="inline-flex max-w-full items-center gap-0.5 self-start overflow-x-auto overscroll-x-contain rounded-full bg-secondary/60 p-0.5"
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

        {searchAtTop ? (
          <div className="w-full sm:max-w-56">{searchField}</div>
        ) : null}
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
          <MyChannelsErrorState message={explainedError} onRetry={retry} />
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
                    {section.rows.map((group, index) => (
                      <MyChannelGroupRows
                        key={group.channel.uuid}
                        group={group}
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

      {/* The floating search pill, and nothing else: nothing is created from
          this screen — a channel is made inside the space that owns it. */}
      {searchAtTop ? null : (
        <ScreenDock>
          <ScreenDockSearch>{searchField}</ScreenDockSearch>
        </ScreenDock>
      )}
    </div>
  );
}

/**
 * Route fallback — the toolbar's reserved shape over the real list skeleton.
 * `app/v2/channels/(index)/loading.tsx` renders this, so the boundary and the
 * live screen are one continuous shape. `aria-hidden` + `inert`: a fallback is
 * deleted rather than reconciled, so nothing focusable may live in it.
 *
 * The list skeleton pulses here exactly as it does on the live screen. Two
 * appearances for one wait would show the reader a load that stops and starts
 * again in the middle. The lens strip and the search box are not skeletons at
 * all: they are chrome that waits on nothing, so they are drawn as the plain
 * shapes they will become.
 */
export function MyChannelsFallback() {
  const searchAtTop = useSearchPosition() === 'top';
  return (
    <>
      <span role="status" className="sr-only">
        Loading your channels
      </span>
      <div aria-hidden inert className={LIST_COLUMN_DOCKED}>
        <ScreenTitle />
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-9 w-48 self-start rounded-full bg-secondary/60" />
          {searchAtTop ? <SearchFieldShape className="w-full sm:max-w-56" /> : null}
        </div>
        <MyChannelsSkeleton />
        {searchAtTop ? null : (
          <ScreenDock>
            <ScreenDockSearch>
              <SearchFieldShape />
            </ScreenDockSearch>
          </ScreenDock>
        )}
      </div>
    </>
  );
}
