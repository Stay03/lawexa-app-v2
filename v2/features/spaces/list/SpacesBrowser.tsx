'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { channelsQueries } from '@/v2/features/channels/queries';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { collabAccessState } from '@/v2/features/collab/model';
import { usePendingInvitationCount } from '@/v2/features/invitations/use-pending-count';
import { useV2Session } from '@/v2/runtime/session-context';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import {
  SpaceFormDialog,
  spaceCreationHref,
} from '../dialogs/SpaceFormDialog';
import { parseSpaceFilter, type SpaceFilter } from '../model';
import { SPACES_BASELINE_PARAMS, spacesQueries } from '../queries';
import { PendingPill } from './PendingPill';
import { SpaceRow } from './SpaceRow';
import { SpaceTypeTabs } from './SpaceTypeTabs';
import { NO_SPACE_ACTIVITY, spaceActivityIndex } from './space-activity';
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
 * ── THE LANES READ A SECOND CACHE, AND SPEND NOTHING FOR IT ────────────────
 * Channel chips and last-activity come from `channelsQueries.mine`, which the
 * realtime spine already mounts app-wide with these exact params — so this is
 * the SAME cache entry, warm on arrival, live between refetches, and costing
 * no request. It is a progressive enhancement: while it is cold or empty the
 * lanes name what each space IS instead, and nothing waits on it.
 *
 * ── THE TOOLBAR IS STATIC CHROME, AND ONE ITEM LESS ────────────────────────
 * The tab strip and New space render on the first frame and never wait on data
 * (standards §8i). Invitations is no longer permanent chrome: it appears as a
 * `PendingPill` only when something is actually waiting, and it expands into
 * the gap AFTER the tabs so the primary action on the right never moves.
 *
 * ── THE CREATE DIALOG IS IN THE URL ────────────────────────────────────────
 * `?panel=new`, on the shared `useUrlOverlay`, so Back closes it — the owner's
 * ask ("create and edit space should have url state… so back button and all
 * that works"); edit already had it. The hook also absorbs the remount
 * contract the local `useDialog` existed for, which is why that hook is gone:
 * `openKey` bumps on every ARRIVAL so the form re-derives its fields, and
 * never on departure so Radix Presence still plays the close.
 */

const PANEL_ID = 'spaces-list-panel';

/** The one panel this screen puts in `?panel=`. */
const CREATE_PANEL = 'new';

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

  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = parseSpaceFilter(searchParams.get('type'));

  const panel = useUrlOverlay('panel');
  const createDialog = panel.bind(CREATE_PANEL);
  const openCreate = () => panel.show(CREATE_PANEL);

  // Frozen at mount for the lanes' relative ages — the list refetches on
  // arrival, so clock and data move together and no `Date.now()` runs in
  // render (React Compiler lint).
  const [now] = useState(() => Date.now());

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

  // Same params as the spine's mount (`spine.tsx`), so this resolves to that
  // entry rather than minting a second one.
  const myChannels = useQuery({
    ...channelsQueries.mine({ viewerId }),
    enabled: eligible,
  });

  const pendingInvitations = usePendingInvitationCount({ viewerId, enabled: eligible });

  const setFilter = (next: SpaceFilter) => {
    replaceUrlParams({ type: next === 'all' ? null : next });
  };

  const spaces = query.data?.data ?? [];

  const myChannelRows = myChannels.data?.data;
  const activityBySpace = useMemo(
    () => spaceActivityIndex(myChannelRows ?? []),
    [myChannelRows],
  );

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
        <PendingPill count={pendingInvitations} />

        <Button size="sm" className="ml-auto shrink-0" onClick={openCreate}>
          <Plus aria-hidden className="size-4" />
          New space
        </Button>
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
            onCreate={openCreate}
            onShowAll={filter === 'all' ? undefined : () => setFilter('all')}
          />
        ) : (
          <>
            {showInlineError ? (
              <CollabFailure
                className="mb-3"
                message="Couldn’t refresh your spaces — showing your last ones."
                onRetry={() => void query.refetch()}
              />
            ) : null}

            <ul className="flex flex-col gap-2">
              {spaces.map((space, index) => (
                <SpaceRow
                  key={space.uuid}
                  space={space}
                  activity={activityBySpace.get(space.uuid) ?? NO_SPACE_ACTIVITY}
                  now={now}
                  index={index}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Mounted unconditionally so Radix Presence can play the CLOSING
          transition; `keyFor` remounts it on each opening so the fields are
          fresh. The key is asked for BY VALUE — the no-argument form keys on
          the hook's unnamed `'1'`, which this param never carries, so it would
          never change and the form would keep the values it was born with. */}
      <SpaceFormDialog
        key={panel.keyFor(CREATE_PANEL)}
        open={createDialog.open}
        onOpenChange={createDialog.onOpenChange}
        viewerId={viewerId}
        onCreated={(spaceUuid, defaultChannelUuid) => {
          // Success is a MOVE. The dialog's entry is rewritten rather than
          // popped, so the push below is not racing a queued `history.back()`
          // that would land the reader back on the list.
          panel.closeInPlace();
          router.push(spaceCreationHref(spaceUuid, defaultChannelUuid));
        }}
      />
    </PageShell>
  );
}
