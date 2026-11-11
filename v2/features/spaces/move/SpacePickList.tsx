'use client';

import { useMemo, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { Space } from '@/types/collab';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { canOpenTeamChannels, collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { SearchField } from '@/v2/shell/SearchField';
import { movePickerCutLine } from '../content-model';
import { spaceKindMark, spaceOwnerLabel, spaceRoleWord } from '../model';
import { SPACES_BASELINE_PARAMS, spacesQueries } from '../queries';
import { useServerSearch } from '../use-server-search';

/**
 * SpacePickList — the reader's Spaces as a list to pick one from, for every
 * dialog that sends something to a Space: Move to a space, and Host a live
 * quiz from outside one. The dialog says which Spaces qualify (`targets`) and
 * what a pick does; the list is the same in each.
 *
 * ── NO SILENT CUT (techlead decision 2, Spaces F3) ─────────────────────────
 * The server sends a page of 30. The search box asks the server (`/spaces`
 * `search`), so a Space beyond the first page can be found by name, and when
 * the server holds more than the page it sent, a line under the list says so
 * (`movePickerCutLine`). The rows on screen stay while a new search is on its
 * way, dimmed, rather than dropping to a skeleton on every keystroke. The
 * unsearched rows are the `/spaces` list's own baseline entry, so a reader who
 * has seen their Spaces opens this on rows already in hand.
 *
 * ── ONE TAP PICKS ──────────────────────────────────────────────────────────
 * The tapped row shows the wait (`busyUuid`) and every other row is held
 * still while it runs (`disabled`). The row the item is in now
 * (`currentUuid`) stays on the list, marked, and cannot be picked again.
 *
 * ── TWO LOOKS ──────────────────────────────────────────────────────────────
 * `plain` (the default, Move's) draws the rows as a flat list. `quiz` draws
 * each row as a card in the solo quiz's design (rounded-2xl on a 2px border),
 * for Host a live quiz, which sits among the quiz screens (Stay and Arthur,
 * 11 November 2026). The rows say and do the same in both.
 */
export function SpacePickList({
  targets,
  onPick,
  busyUuid,
  disabled,
  currentUuid = null,
  noMatch,
  empty,
  after,
  look = 'plain',
}: {
  /** Which of the reader's Spaces can be picked here. */
  targets: (spaces: readonly Space[]) => Space[];
  onPick: (space: Space) => void;
  /** The row whose pick is on its way, which shows the wait. */
  busyUuid: string | null;
  /** Every row held still: a pick is on its way. */
  disabled: boolean;
  /** The Space the item is in now, marked and not pickable. */
  currentUuid?: string | null;
  /** The sentence when a search finds no Space that qualifies. */
  noMatch: (term: string) => string;
  /** What shows when the reader has no Space that qualifies at all. */
  empty: ReactNode;
  /** A last row under the Spaces (Host's "New Space"), drawn whenever the list is. */
  after?: ReactNode;
  /** How the rows are drawn: Move's flat list, or the quiz screens' cards. */
  look?: 'plain' | 'quiz';
}) {
  const quizLook = look === 'quiz';
  const session = useV2Session();
  const search = useServerSearch();
  const teamChannelsOpen = canOpenTeamChannels(session);

  const spacesQuery = useQuery({
    ...spacesQueries.list({
      viewerId: session.userId,
      ...(search.term ? { search: search.term } : SPACES_BASELINE_PARAMS),
    }),
    enabled: collabAccessState(session) === 'eligible',
    placeholderData: keepPreviousData,
  });
  const rows = spacesQuery.data?.data;
  const pagination = spacesQuery.data?.pagination;
  const picks = useMemo(() => (rows ? targets(rows) : []), [rows, targets]);
  const cutLine = movePickerCutLine(
    picks.length,
    rows && pagination ? { rows: rows.length, total: pagination.total } : null,
  );

  return (
    <>
      <SearchField
        value={search.value}
        onChange={search.setValue}
        onClear={search.clear}
        placeholder="Search your spaces"
        label="Search your spaces"
        busy={spacesQuery.isPlaceholderData}
      />

      <div
        className={cn(
          'relative -mx-2 max-h-[min(22rem,55vh)] overflow-y-auto overscroll-y-contain',
          'transition-opacity duration-150 motion-reduce:transition-none',
          spacesQuery.isPlaceholderData && 'opacity-60',
        )}
      >
        {spacesQuery.isPending ? (
          <SpacePickSkeleton />
        ) : spacesQuery.isError ? (
          <CollabFailure
            className="mx-2"
            message="Couldn’t load your spaces."
            onRetry={() => void spacesQuery.refetch()}
          />
        ) : picks.length === 0 && search.term ? (
          <div className="px-2 py-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
            <p className="text-sm font-medium text-foreground">{noMatch(search.term)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another word, or clear the search.</p>
          </div>
        ) : picks.length === 0 && cutLine === null ? (
          empty
        ) : (
          <ul
            className={cn(
              'flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150',
              // The cards keep the scroller's 8px gutter, so a focus ring is
              // never cut at the edge.
              quizLook ? 'gap-2 px-2 py-1' : 'gap-0.5',
            )}
          >
            {picks.map((space) => {
              const isCurrent = space.uuid === currentUuid;
              const isSending = busyUuid === space.uuid;
              // The list's word for the same person (`spaceRoleWord`).
              const role = spaceRoleWord(space);
              const kind = spaceKindMark(space, teamChannelsOpen);
              return (
                <li key={space.uuid}>
                  <button
                    type="button"
                    disabled={isCurrent || disabled}
                    onClick={() => onPick(space)}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={cn(
                      'v2-interactive flex w-full items-center gap-3 text-left transition-colors disabled:cursor-default',
                      quizLook
                        ? 'rounded-2xl border-2 border-border bg-card px-3 py-2.5 hover:border-primary/40 disabled:hover:border-border'
                        : 'rounded-lg px-2 py-2 hover:bg-secondary/60 disabled:hover:bg-transparent',
                      disabled && !isSending && 'opacity-60',
                      FOCUS_RING,
                    )}
                  >
                    <SpaceCrest uuid={space.uuid} name={space.name} type={space.type} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">
                          {space.name}
                        </span>
                        {kind ? (
                          <span className="shrink-0 rounded-md border border-border px-1.5 text-[10px] font-medium leading-4 text-muted-foreground">
                            {kind}
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[role, spaceOwnerLabel(space)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {isSending ? (
                      <Loader2 aria-hidden className="size-4 shrink-0 text-muted-foreground motion-safe:animate-spin" />
                    ) : isCurrent ? (
                      // Below sm the check stands alone, so the row the
                      // item is in keeps its whole name on a phone.
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Check aria-hidden className="size-3.5" />
                        <span className="sr-only sm:not-sr-only">In it now</span>
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {after ? <li>{after}</li> : null}
          </ul>
        )}
      </div>

      {cutLine ? <p className="-mt-3 text-xs text-muted-foreground">{cutLine}</p> : null}
    </>
  );
}

/** Three rows at the picker's exact geometry: crest, name, meta line. */
function SpacePickSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-0.5">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex items-center gap-3 px-2 py-2"
          style={{ opacity: 1 - index * 0.25 }}
        >
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/5 rounded" />
            <Skeleton className="h-3 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
