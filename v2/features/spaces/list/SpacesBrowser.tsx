'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Mail, Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { collabAccessState } from '@/v2/features/collab/model';
import { usePendingInvitationCount } from '@/v2/features/invitations/use-pending-count';
import { useV2Session } from '@/v2/runtime/session-context';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { SpaceFormDialog } from '../dialogs/SpaceFormDialog';
import { parseSpaceFilter, type SpaceFilter } from '../model';
import { SPACES_BASELINE_PARAMS, spacesQueries } from '../queries';
import { useDialog } from '../use-dialog';
import { SpaceRow } from './SpaceRow';
import { SpaceTypeTabs } from './SpaceTypeTabs';
import { SpacesEmptyState, SpacesErrorState, SpacesListSkeleton } from './states';

/**
 * SpacesBrowser — the `/spaces` body, and the `useSearchParams` consumer (so it
 * lives under the Suspense boundary `SpacesScreen` provides).
 *
 * ── ONE STREAM, TYPE AS A FILTER ───────────────────────────────────────────
 * Work and Study are a FILTER, never a layout: the server returns the caller's
 * spaces in one list, and splitting the page into two headed sections would
 * bury a busy Study space under a heading while a quiet Work one sat at the
 * top. The tab strip narrows the same stream (study A1's verdict, and the
 * `/bookmarks` precedent).
 *
 * ── THE URL IS THE STATE ───────────────────────────────────────────────────
 * `?type=` is the tab, written with the LOUD native-history write
 * (`replaceUrlParams`) because this component reads it back through
 * `useSearchParams`, which only sees loud writes. `/spaces` is a static segment
 * whose server page reads no `searchParams`, so a `router.push` would pay an
 * RSC round trip and re-show `loading.tsx` for a filter the client already
 * applied. Absent means All, so the bare `/spaces` URL is the unfiltered view.
 *
 * ── NO CARRY-OVER BETWEEN TABS, AND NO SKELETON EITHER ─────────────────────
 * Each filter is its own cache entry with 30-minute retention, so a tab the
 * reader has already visited paints from cache with no skeleton at all — the
 * "never a skeleton over content already in cache" rule kept by the cache,
 * where it belongs, rather than by borrowing another tab's rows.
 *
 * ── THE THREE ACTIONS ──────────────────────────────────────────────────────
 * The tab strip and the action pair are STATIC CHROME: they render on the
 * first frame and never wait on data (standards §8i — v1 hid its tabs behind
 * the list's loading state, which is exactly what that rule forbids). The
 * Invitations entry carries the live pending count from the same three cache
 * entries the `/invitations` screen reads, so following it paints instantly.
 *
 * Phase-5 W4, 2026-08-04.
 */

const PANEL_ID = 'spaces-list-panel';

/** The centred reading column every state shares (`page-columns.ts`), so this
 *  page, `/cases`, `/bookmarks` and `/conversations` are one measure. */
function PageShell({ children }: { children: React.ReactNode }) {
  return <div className={LIST_COLUMN}>{children}</div>;
}

export function SpacesBrowser() {
  const session = useV2Session();
  const viewerId = session.userId;
  // The gate above this screen has already refused everyone else; the same
  // predicate gates the FETCH, so an ineligible viewer never spends a request
  // to be told what the session snapshot already knows.
  const eligible = collabAccessState(session) === 'eligible';

  const searchParams = useSearchParams();
  const filter = parseSpaceFilter(searchParams.get('type'));

  const createDialog = useDialog();

  // THE "ALL" TAB SHARES THE SPINE'S BASELINE ENTRY. `SPACES_BASELINE_PARAMS`
  // is the exact param shape the realtime spine already mounts for its badge
  // rollups, so arriving here paints rows in the first frame instead of
  // skeletoning over a warm cache and firing a second request. A filtered tab
  // asks a different question and correctly gets its own entry.
  const query = useQuery({
    ...spacesQueries.list(
      filter === 'all'
        ? { ...SPACES_BASELINE_PARAMS, viewerId }
        : { ...SPACES_BASELINE_PARAMS, type: filter, viewerId },
    ),
    enabled: eligible,
  });

  const pendingInvitations = usePendingInvitationCount({ viewerId, enabled: eligible });

  const setFilter = (next: SpaceFilter) => {
    replaceUrlParams({ type: next === 'all' ? null : next });
  };

  const spaces = query.data?.data ?? [];

  // A 4xx is a REFUSAL the server explained; a 5xx or a network drop is not,
  // and its message ("Network error…") is less useful than the designed copy.
  const apiError = query.error ? extractApiError(query.error) : null;
  const explainedError =
    apiError && apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : undefined;

  // Every state decision reads the loaded set, never a projection.
  const showSkeleton = query.isPending;
  const showError = query.isError && spaces.length === 0;
  const showEmpty = !showSkeleton && !showError && spaces.length === 0;
  const showInlineError = query.isError && spaces.length > 0;

  return (
    <PageShell>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SpaceTypeTabs value={filter} onChange={setFilter} panelId={PANEL_ID} />

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/invitations" className={cn('v2-interactive', FOCUS_RING)}>
              <Mail aria-hidden className="size-4" />
              Invitations
              {pendingInvitations > 0 ? (
                <span
                  aria-hidden
                  className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 motion-safe:duration-200"
                >
                  {pendingInvitations > 99 ? '99+' : pendingInvitations}
                </span>
              ) : null}
              {/* The count is announced in words rather than as a bare number
                  beside the label, so a screen reader hears one sentence. */}
              {pendingInvitations > 0 ? (
                <span className="sr-only">
                  {`, ${pendingInvitations} pending`}
                </span>
              ) : null}
            </Link>
          </Button>

          <Button size="sm" onClick={createDialog.show}>
            <Plus aria-hidden className="size-4" />
            New space
          </Button>
        </div>
      </div>

      {/* The ONE live region for this surface. The route fallback's
          announcement is gone by the time an in-page fetch happens and the
          skeleton itself is `aria-hidden`, so without this a first load and a
          tab switch are both silent. Derived purely from render values, so it
          can never announce something that is not on screen. */}
      <span role="status" aria-live="polite" className="sr-only">
        {showSkeleton ? 'Loading your spaces' : ''}
      </span>

      <div id={PANEL_ID} role="tabpanel" aria-labelledby={`${PANEL_ID}-tab-${filter}`}>
        {showSkeleton ? (
          <SpacesListSkeleton />
        ) : showError ? (
          <SpacesErrorState
            message={explainedError}
            onRetry={() => void query.refetch()}
          />
        ) : showEmpty ? (
          <SpacesEmptyState
            filter={filter}
            onCreate={createDialog.show}
            onShowAll={filter === 'all' ? undefined : () => setFilter('all')}
          />
        ) : (
          <>
            {showInlineError ? (
              <div
                role="alert"
                className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                <span>Couldn&rsquo;t refresh your spaces — showing your last ones.</span>
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
              {spaces.map((space, index) => (
                <SpaceRow key={space.uuid} space={space} index={index} />
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Mounted unconditionally so Radix Presence can play the CLOSING
          transition; `key` remounts it on each opening so the fields are
          fresh. See `useDialog`. */}
      <SpaceFormDialog
        key={createDialog.openKey}
        open={createDialog.open}
        onOpenChange={createDialog.setOpen}
        viewerId={viewerId}
      />
    </PageShell>
  );
}
