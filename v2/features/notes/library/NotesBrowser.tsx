'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { useUrlSearch } from '@/v2/runtime/use-url-search';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { SearchField } from '@/v2/shell/SearchField';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useInfiniteScrollSentinel } from '@/v2/shell/use-infinite-scroll';
import { useShellScrollRoot } from '@/v2/shell/use-shell-scroll-root';
import { notesQueries } from '../queries';
import { canWriteNotes } from '../note-access';
import { isLibraryListable, noteRow, type NoteRowModel } from '../note-row-model';
import { NoteRow } from './NoteRow';
import { NoteTabs, parseNotesTab, type NotesTab } from './NoteTabs';
import {
  NextPageSkeleton,
  NotesCreateAccountState,
  NotesEmptyState,
  NotesErrorState,
  NotesListSkeleton,
  NotesSignedOutState,
} from './states';

/**
 * NotesBrowser — the `/notes` body, and the `useSearchParams` consumer (so it
 * lives under the Suspense boundary in `NotesScreen`).
 *
 * ── TWO STREAMS, TWO HOOKS, ONE PANEL ───────────────────────────────────────
 * All notes and My notes are DIFFERENT COLLECTIONS, not two filters of one, so
 * each gets its own `useInfiniteQuery` and only the active one is `enabled`.
 * Both hooks are called unconditionally (rules of hooks), which is not a
 * workaround but the point: because the tab is NOT part of either key,
 * `keepPreviousData` can only ever carry rows across a SEARCH change WITHIN a
 * stream. A single hook keyed on the tab would carry strangers' notes, dimmed,
 * under a tab labelled "My notes" — the failure the `/bookmarks` browser
 * refuses `keepPreviousData` outright to avoid. Here the structure prevents it
 * instead, so search keeps its no-skeleton-over-content behaviour and the tab
 * still cannot lie. A tab the reader has already visited paints from its own
 * 30-minute cache entry, with no skeleton at all.
 *
 * ── THE URL IS THE STATE ────────────────────────────────────────────────────
 * `?tab=mine` and `?search=` both live in the query string, so every view of
 * the library is a shareable link. Both are written with the LOUD native
 * history write (`replaceUrlParams` / `useUrlSearch`), which this component
 * reads back through `useSearchParams`; `/notes` is a static segment whose
 * server page reads no `searchParams`, so a `router.push` would pay an RSC
 * round trip and re-show `loading.tsx` for a filter the client already
 * applied. v1 pushed a router navigation PER KEYSTROKE.
 *
 * ── WHO CAN READ AND WHO CAN WRITE ──────────────────────────────────────────
 * Measured against production on August 4 2026: `GET /api/notes` answers 401
 * with no bearer token, so the queries are gated on the session and a visitor
 * with no session gets the designed sign-in state. A GUEST holds a real token
 * and browses the library normally — but a guest cannot author, so My notes
 * shows the create-account panel rather than an empty list, and no "New note"
 * affordance is drawn for them (`canWriteNotes`).
 *
 * ── PAID AND DRAFT NOTES CANNOT REACH THE LIBRARY STREAM ────────────────────
 * The wire layer bakes `free: true` into the request and the endpoint returns
 * published notes only; `isLibraryListable` re-checks both on the row. See
 * that function for why a render-side gate earns its keep over a request
 * parameter.
 */

/** Stable empty rows reference — a fresh `[]` per render would churn the memo. */
const NO_ROWS: readonly NoteRowModel[] = [];

const PANEL_ID = 'notes-list-panel';

/** The centred reading column every state shares (`page-columns.ts`), so this
 *  page, `/cases`, `/statutes` and `/bookmarks` are one measure. */
function PageShell({ children }: { children: React.ReactNode }) {
  return <div className={LIST_COLUMN}>{children}</div>;
}

export function NotesBrowser() {
  const { signedIn, userId: viewerId, role } = useV2Session();
  const searchParams = useSearchParams();
  const tab = parseNotesTab(searchParams.get('tab'));
  const { committedSearch, inputValue, onInputChange, onClear } = useUrlSearch();
  const activeSearch = committedSearch.trim();
  const canWrite = signedIn && canWriteNotes(role);

  // Frozen at mount for the relative "updated" labels — no `Date.now()` runs
  // in render (React Compiler lint).
  const [now] = useState(() => Date.now());

  const params = { search: activeSearch || undefined, viewerId };

  const libraryQuery = useInfiniteQuery({
    ...notesQueries.library(params),
    enabled: signedIn && tab === 'all',
    // Keep the current results visible (dimmed) while a new SEARCH resolves.
    // Scoped to this stream by construction — see the docblock.
    placeholderData: keepPreviousData,
  });

  const mineQuery = useInfiniteQuery({
    ...notesQueries.mine(params),
    // A guest can never own a note, so the request is never made — the panel
    // below is the answer, not an empty list from a call we knew the shape of.
    enabled: signedIn && canWrite && tab === 'mine',
    placeholderData: keepPreviousData,
  });

  const query = tab === 'mine' ? mineQuery : libraryQuery;

  const pages = query.data?.pages;
  const rows = useMemo<readonly NoteRowModel[]>(() => {
    if (!pages) return NO_ROWS;
    const mapped: NoteRowModel[] = [];
    for (const page of pages) {
      for (const note of page.data) {
        // Belt-and-braces: the public stream never shows a paid or draft note,
        // whatever the request asked for. My notes is the reader's own
        // collection, drafts included — that is the whole point of the tab.
        if (tab === 'all' && !isLibraryListable(note)) continue;
        mapped.push(noteRow(note));
      }
    }
    return mapped;
  }, [pages, tab]);

  const scrollRootRef = useShellScrollRoot();
  const sentinelRef = useInfiniteScrollSentinel<HTMLDivElement>({
    hasNextPage: query.hasNextPage && !query.isPlaceholderData,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    rootRef: scrollRootRef,
    rootMargin: '320px',
  });

  const setTab = (next: NotesTab) => {
    replaceUrlParams({ tab: next === 'all' ? null : next });
  };

  // The API's own reason, read once. A 4xx is a REFUSAL the server explained;
  // a 5xx or a network drop is not, and its message ("Network error…") is less
  // useful than the designed copy.
  const apiError = query.error ? extractApiError(query.error) : null;
  const explainedError =
    apiError && apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : undefined;

  // Every state decision reads the loaded set, never a projection.
  const guestOnMine = tab === 'mine' && signedIn && !canWrite;
  const showSkeleton = query.isPending && !guestOnMine;
  const showError = query.isError && rows.length === 0;
  const showEmpty = !showSkeleton && !showError && rows.length === 0;
  const showInlineError = query.isError && rows.length > 0;
  // Dim ONLY while a new search is actually resolving, so an errored, settled
  // query can never strand the list at reduced opacity.
  const dim = query.isPlaceholderData && query.isFetching;

  if (!signedIn) {
    return (
      <PageShell>
        <NotesSignedOutState />
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Static chrome: the search box and the tab strip render on the first
          frame and never wait on data (standards §8i — v1 hid its tabs behind
          the list's loading state, which is exactly what that rule forbids). */}
      <SearchField
        value={inputValue}
        onChange={onInputChange}
        onClear={onClear}
        busy={dim}
        placeholder="Search notes by title or content..."
        label="Search notes by title or content"
        className="mb-3"
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <NoteTabs value={tab} onChange={setTab} panelId={PANEL_ID} />
        {canWrite ? (
          <Link
            href="/notes/create"
            className={cn(
              'v2-interactive inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
              FOCUS_RING,
            )}
          >
            <Plus aria-hidden className="size-4" />
            {/* The label is the affordance on a desktop; on a phone the row
                has to hold the tab strip too, so the icon carries it and the
                accessible name comes from the visually-hidden word. */}
            <span className="sr-only sm:not-sr-only">New note</span>
          </Link>
        ) : null}
      </div>

      {/* The ONE live region for this surface. The route fallback's
          announcement is gone by the time an in-page fetch happens and the
          skeleton itself is `aria-hidden`, so without this a first load and a
          tab switch are both silent. Polite, text-only, and derived purely
          from render values, so it can never announce something that is not on
          screen. */}
      <span role="status" aria-live="polite" className="sr-only">
        {showSkeleton ? 'Loading notes' : ''}
      </span>

      <div id={PANEL_ID} role="tabpanel" aria-labelledby={`${PANEL_ID}-tab-${tab}`}>
        {guestOnMine ? (
          <NotesCreateAccountState />
        ) : showSkeleton ? (
          <NotesListSkeleton />
        ) : showError ? (
          <NotesErrorState
            message={explainedError}
            onRetry={() => void query.refetch()}
          />
        ) : showEmpty ? (
          <NotesEmptyState
            tab={tab}
            search={activeSearch}
            canWrite={canWrite}
            onClearSearch={onClear}
          />
        ) : (
          <div
            className={cn(
              'transition-opacity duration-200 motion-reduce:transition-none',
              dim && 'pointer-events-none opacity-60',
            )}
          >
            {showInlineError ? (
              <div
                role="alert"
                className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                <span>Couldn&rsquo;t update the results — showing your last ones.</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => void query.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : null}

            <ul className="flex flex-col divide-y divide-border/60">
              {rows.map((row, index) => (
                <NoteRow
                  key={row.id}
                  row={row}
                  index={index}
                  now={now}
                  showStatus={tab === 'mine'}
                />
              ))}
            </ul>

            {/* Sentinel + end-cap: while more pages exist this sits at the end
                of the scroll region; once fully loaded the quiet end-cap
                replaces it. */}
            <div ref={sentinelRef} className="pt-1">
              {query.isFetchingNextPage ? (
                <NextPageSkeleton />
              ) : !query.hasNextPage ? (
                <p className="py-6 text-center text-xs text-muted-foreground/70">
                  No more notes
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
