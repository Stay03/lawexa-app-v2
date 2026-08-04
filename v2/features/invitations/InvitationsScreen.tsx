'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { useExitingRows } from '@/v2/features/bookmarks/list/use-exiting-rows';
import { collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { InvitationRow } from './InvitationRow';
import {
  usePendingInvitationResponses,
  useRespondToInvitation,
  type InvitationAction,
  type InvitationKind,
} from './mutations';
import { invitationsQueries } from './queries';
import {
  channelInvitationRow,
  organizationInvitationRow,
  spaceInvitationRow,
  type InvitationRowModel,
} from './row-model';
import {
  InvitationsEmptyState,
  InvitationsErrorState,
  InvitationsSkeleton,
} from './states';

/**
 * InvitationsScreen — the ONE invitations surface (owner decision D5; study
 * A7). v1 served the same component from four URLs; v2 has one route, and W5
 * redirects the three legacy paths onto it so old notification `action_url`s
 * keep working.
 *
 * ── THREE SECTIONS, ONE STREAM OF DECISIONS ────────────────────────────────
 * Unlike `/bookmarks` — where type is a filter because the reader is scanning
 * ONE collection — an invitation's kind changes what accepting MEANS: joining
 * an organization, a space, or a single channel are three different
 * commitments. So the kinds are SECTIONS, ordered widest-first (organization →
 * space → channel), and a section with no rows is not rendered at all rather
 * than rendered empty.
 *
 * ── PARTIAL FAILURE IS NOT FAILURE ─────────────────────────────────────────
 * The three inboxes are three requests. All three failing is the error state;
 * ONE failing leaves the others rendered with a quiet line saying some
 * invitations couldn't be checked. Blanking two working sections because a
 * third timed out would be the screen throwing away what it has.
 *
 * ── ANSWERING ──────────────────────────────────────────────────────────────
 * The row leaves in the same tick as the press (optimistic; the pending badge
 * on `/spaces` falls with it), plays a held collapse rather than snapping out,
 * and cannot be repainted by any refetch while its write is in flight. A
 * failure rolls it back — that IS the visible answer — and the reason comes
 * from the ONE global mutation-error channel, not from a toast raised here.
 *
 * ── WHY ACCEPTING USUALLY DOES NOT NAVIGATE ────────────────────────────────
 * An inbox is answered, not visited: yanking the reader into the first thing
 * they accept strands the rest of their invitations behind a Back press. So
 * the row simply leaves — EXCEPT when it was the last one, where there is
 * nothing left to answer and the honest next step is the thing they just
 * joined.
 *
 * Phase-5 W4, 2026-08-04.
 */

/** Section order and headings — widest commitment first. */
const SECTIONS: readonly { kind: InvitationKind; label: string }[] = [
  { kind: 'organization', label: 'Organization' },
  { kind: 'space', label: 'Spaces' },
  { kind: 'channel', label: 'Channels' },
];

/** Stable empty rows reference — a fresh `[]` per render would churn the memo. */
const NO_ROWS: readonly InvitationRowModel[] = [];

/** Module-level so the holdover's `beginExit` stays referentially stable,
 *  which is what keeps `InvitationRow`'s `memo` holding. */
const rowKey = (row: InvitationRowModel): string => row.key;

export function InvitationsScreen() {
  const session = useV2Session();
  const viewerId = session.userId;
  const eligible = collabAccessState(session) === 'eligible';
  const router = useRouter();

  // Frozen at mount for the relative ages — the inboxes refetch on arrival, so
  // clock and data move together and no `Date.now()` runs in render.
  const [now] = useState(() => Date.now());
  /** The polite announcement after a successful accept. */
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    setHeaderContext({ title: 'Invitations', confidential: false });
    return () => clearHeaderContext();
  }, []);

  const organizationsQuery = useQuery({
    ...invitationsQueries.organizations({ viewerId }),
    enabled: eligible,
  });
  const spacesQuery = useQuery({
    ...invitationsQueries.spaces({ viewerId }),
    enabled: eligible,
  });
  const channelsQuery = useQuery({
    ...invitationsQueries.channels({ viewerId }),
    enabled: eligible,
  });

  const respond = useRespondToInvitation();
  const pending = usePendingInvitationResponses();

  const organizationsData = organizationsQuery.data;
  const spacesData = spacesQuery.data;
  const channelsData = channelsQuery.data;

  // ONE ordered array: the holdover splices exiting rows back by index, so the
  // sections are derived from its output rather than held separately.
  const rows = useMemo<readonly InvitationRowModel[]>(() => {
    if (!organizationsData && !spacesData && !channelsData) return NO_ROWS;
    const mapped: InvitationRowModel[] = [];
    for (const invitation of organizationsData?.data ?? []) {
      mapped.push(organizationInvitationRow(invitation));
    }
    for (const invitation of spacesData?.data ?? []) {
      mapped.push(spaceInvitationRow(invitation));
    }
    for (const invitation of channelsData?.data ?? []) {
      mapped.push(channelInvitationRow(invitation));
    }
    // A row whose answer is in flight cannot be painted by any refetch.
    return mapped.filter((row) => !pending.has(row.key));
  }, [organizationsData, spacesData, channelsData, pending]);

  const { presented, beginExit } = useExitingRows(rows, rowKey);

  // `respond.mutate` is referentially stable across renders (TanStack binds it
  // once); depending on the whole mutation RESULT would rebuild this callback
  // on every status tick and bust `InvitationRow`'s `memo` for the entire list.
  const respondMutate = respond.mutate;

  const handleRespond = useCallback(
    (row: InvitationRowModel, action: InvitationAction) => {
      // THE HOLDOVER INDEXES INTO THE FLAT `presented` ARRAY, NOT THE SECTION.
      // Rows are rendered per section but held in one ordered list, so passing
      // a section-relative index would re-splice the exiting row near the top
      // of the flat list — a declined channel invitation would visibly jump
      // above its siblings before collapsing. The row's own key is the only
      // reliable way back to its flat position.
      const flatIndex = presented.findIndex((entry) => entry.row.key === row.key);
      if (flatIndex === -1) return;

      // Nothing left to answer afterwards ⇒ take them to what they joined.
      const wasLast = presented.length === 1;
      setAnnouncement('');
      beginExit(row, flatIndex);
      respondMutate(
        { kind: row.kind, id: row.id, action },
        {
          onSuccess: () => {
            if (action !== 'accept') return;
            setAnnouncement(row.acceptedLabel);
            if (wasLast && row.href) router.push(row.href);
          },
        },
      );
    },
    [presented, beginExit, respondMutate, router],
  );

  const isPending =
    organizationsQuery.isPending || spacesQuery.isPending || channelsQuery.isPending;
  const failed = [organizationsQuery, spacesQuery, channelsQuery].filter(
    (query) => query.isError,
  );
  const allFailed = failed.length === 3;
  const someFailed = failed.length > 0 && !allFailed;

  const retryAll = () => {
    void organizationsQuery.refetch();
    void spacesQuery.refetch();
    void channelsQuery.refetch();
  };

  return (
    <div className={LIST_COLUMN}>
      <p className="mb-4 text-xs text-muted-foreground">
        Answer invitations to organizations, spaces and channels.
      </p>

      {/* The ONE live region for this surface: the loading state and the
          "joined" confirmation, both derived from render values so neither can
          announce something that is not on screen. */}
      <span role="status" aria-live="polite" className="sr-only">
        {isPending ? 'Checking for invitations' : announcement}
      </span>

      {isPending ? (
        <InvitationsSkeleton />
      ) : allFailed ? (
        <InvitationsErrorState onRetry={retryAll} />
      ) : presented.length === 0 ? (
        <>
          {someFailed ? <PartialFailureNote onRetry={retryAll} /> : null}
          <InvitationsEmptyState />
        </>
      ) : (
        <>
          {someFailed ? <PartialFailureNote onRetry={retryAll} /> : null}
          <div className="flex flex-col gap-6">
            {SECTIONS.map((section) => {
              const sectionRows = presented.filter(
                (entry) => entry.row.kind === section.kind,
              );
              if (sectionRows.length === 0) return null;
              return (
                <section key={section.kind}>
                  <h2 className="mb-1 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {section.label}
                  </h2>
                  <ul className="flex flex-col divide-y divide-border/60">
                    {sectionRows.map(({ row, exiting }, index) => (
                      <InvitationRow
                        key={row.key}
                        row={row}
                        now={now}
                        index={index}
                        busy={pending.get(row.key) ?? null}
                        exiting={exiting}
                        onRespond={handleRespond}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** One of the three inboxes failed — say so quietly, keep the rest rendered. */
function PartialFailureNote({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <span>Some invitations couldn&rsquo;t be checked just now.</span>
      <Button variant="outline" size="sm" className="shrink-0" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/**
 * Route fallback — the intro line as a STILL reserved shape over the real
 * skeleton. `app/v2/invitations/loading.tsx` renders this so the boundary and
 * the live screen are one continuous shape. `aria-hidden` + `inert`: a
 * fallback is deleted rather than reconciled, so nothing focusable lives here.
 */
export function InvitationsFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Checking for invitations
      </span>
      <div aria-hidden inert className={LIST_COLUMN}>
        <div className="mb-4 h-4 w-72 max-w-full rounded bg-secondary/60" />
        <InvitationsSkeleton still />
      </div>
    </>
  );
}
