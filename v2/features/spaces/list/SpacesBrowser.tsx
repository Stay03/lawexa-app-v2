'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import { extractApiError } from '@/lib/utils/api-error';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { collabAccessState } from '@/v2/features/collab/model';
import { usePendingInvitationCount } from '@/v2/features/invitations/use-pending-count';
import { useV2Session } from '@/v2/runtime/session-context';
import { replaceUrlParams } from '@/v2/runtime/url-params';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import { CREATE_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { ScreenTitle } from '@/v2/shell/ScreenTitle';
import {
  SpaceFormDialog,
  spaceCreationHref,
} from '../dialogs/SpaceFormDialog';
import { parseSpaceFilter, type SpaceFilter } from '../model';
import { SPACES_BASELINE_PARAMS, spacesQueries } from '../queries';
import { PendingPill } from './PendingPill';
import { SpaceRow } from './SpaceRow';
import { SpaceTypeTabs } from './SpaceTypeTabs';
import { spaceListSections } from './list-rows';
import { SpacesEmptyState, SpacesErrorState, SpacesListSkeleton } from './states';

/**
 * SpacesBrowser — the `/spaces` body, and the `useSearchParams` consumer (so it
 * lives under the Suspense boundary `SpacesScreen` provides).
 *
 * ── TYPE AS A FILTER, OWNERSHIP AS THE SECTIONS ────────────────────────────
 * Work and Study are a FILTER, never a layout: the tab strip narrows the one
 * stream the server returns (study A1's verdict, and the `/bookmarks`
 * precedent). The page IS split by whose space it is (Stay, 15 October 2026:
 * "a way to indicate my spaces from spaces i joined"): "Your spaces", then
 * "Joined" (`spaceListSections`), each keeping the server's order, which is
 * the most recent activity first, so a busy space sits at the top of its own
 * section.
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
 * ── EACH ROW SAYS ITS NEWEST MESSAGE ───────────────────────────────────────
 * The rows read like a chat list (Stay, 15 October 2026): the space's newest
 * message and who sent it, from the row's own `latest_message`, so the list
 * reads nothing beyond its one request. The channel chips that came from the
 * channel cache are gone with the rest of the old lane.
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

/**
 * The centred reading column every state shares (`page-columns.ts`), so this
 * page, `/cases`, `/bookmarks` and `/conversations` are one measure. The plain
 * variant, not the docked one: this screen has no search box, and with "New
 * space" back in the toolbar nothing floats at its bottom edge.
 *
 * The screen's `h1` is drawn here, so every state carries exactly one heading.
 */
/**
 * The column and its title row. On a phone the title row also carries a
 * compact "New" (design round 1, 12 October 2026): with the tabs and the
 * invitations pill filling the toolbar, "New space" used to sit alone on a
 * second row, 72px of height for one button. From `sm:` it is back at the end
 * of the toolbar, where there is room for its full name.
 */
function PageShell({
  onCreate,
  children,
}: {
  onCreate: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={LIST_COLUMN}>
      <div className="flex items-start justify-between gap-3">
        <ScreenTitle />
        <button
          type="button"
          onClick={onCreate}
          className={cn(CREATE_PILL, FOCUS_RING, 'mt-0.5 sm:hidden')}
        >
          <Plus aria-hidden className="size-4" />
          New
          <span className="sr-only">space</span>
        </button>
      </div>
      {children}
    </div>
  );
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

  // "You:" on a row's message line when the reader sent it.
  const viewerUuid = useAuthStore((state) => state.user?.uuid ?? null);

  const pendingInvitations = usePendingInvitationCount({ viewerId, enabled: eligible });

  const setFilter = (next: SpaceFilter) => {
    replaceUrlParams({ type: next === 'all' ? null : next });
  };

  const spaces = query.data?.data;
  const sections = useMemo(() => spaceListSections(spaces ?? []), [spaces]);
  const count = spaces?.length ?? 0;

  // A 4xx is a REFUSAL the server explained; a 5xx or a network drop is not,
  // and its message ("Network error…") is less useful than the designed copy.
  const apiError = query.error ? extractApiError(query.error) : null;
  const explainedError =
    apiError && apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : undefined;

  // Every state decision reads the loaded set, never a projection.
  const showSkeleton = query.isPending;
  const showError = query.isError && count === 0;
  const showEmpty = !showSkeleton && !showError && count === 0;
  const showInlineError = query.isError && count > 0;

  return (
    <PageShell onCreate={openCreate}>
      {/* "New space" is back at the end of this row after a day as a floating
          button the owner turned down ("Remove the floating button from the
          bottom. It looks very messy"). It is a `<button>`, not a link:
          creating a space opens a dialog this screen owns (`?panel=new`,
          written by `useUrlOverlay` so Back closes it), and a link that goes
          nowhere would be a lie to everyone who inspects where it points.
          `ml-auto` is what keeps it pinned right, so the conditional
          invitations pill expands into the gap after the tabs and the primary
          action never moves. Below `sm:` it moves up to the title row
          (`PageShell`). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SpaceTypeTabs value={filter} onChange={setFilter} panelId={PANEL_ID} />
        <PendingPill count={pendingInvitations} />

        <button
          type="button"
          onClick={openCreate}
          className={cn(CREATE_PILL, FOCUS_RING, 'ml-auto hidden sm:inline-flex')}
        >
          <Plus aria-hidden className="size-4" />
          New space
        </button>
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

            {/* Two sections (Stay, 15 October 2026): the spaces the reader
                owns, then the ones they joined, each newest activity first.
                An empty section is left out. */}
            <div className="flex flex-col gap-7">
              {(
                [
                  ['mine', 'Your spaces', sections.mine],
                  ['joined', 'Joined', sections.joined],
                ] as const
              ).map(([id, title, rows], sectionIndex) =>
                rows.length > 0 ? (
                  <section key={id} aria-labelledby={`spaces-section-${id}`}>
                    <h2
                      id={`spaces-section-${id}`}
                      className="mb-2.5 flex items-baseline gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    >
                      {title}
                      <span className="text-xs font-medium tracking-normal normal-case tabular-nums">
                        {rows.length}
                      </span>
                    </h2>
                    <ul className="flex flex-col gap-2">
                      {rows.map((space, index) => (
                        <SpaceRow
                          key={space.uuid}
                          space={space}
                          now={now}
                          index={index + (sectionIndex === 1 ? sections.mine.length : 0)}
                          viewerUuid={viewerUuid}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null,
              )}
            </div>
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
