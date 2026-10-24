'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check, FolderOutput, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { extractApiError } from '@/lib/utils/api-error';
import type { Space } from '@/types/collab';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { COLLAB_DIALOG_SURFACE } from '@/v2/features/collab/kit/dialog-surface';
import { canOpenTeamChannels, collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { SearchField } from '@/v2/shell/SearchField';
import { useMoveToSpace } from '../content-mutations';
import {
  movePickerCutLine,
  moveRefusal,
  moveTargets,
  offersRemoveFromSpace,
  SPACE_ITEM_NOUN,
  type SpaceItemTarget,
} from '../content-model';
import { spaceKindMark, spaceOwnerLabel, spaceRoleWord } from '../model';
import { SPACES_BASELINE_PARAMS, spacesQueries } from '../queries';
import { useServerSearch } from '../use-server-search';

/**
 * MoveToSpaceDialog — put an item the viewer owns into one of their spaces,
 * or take it back out (Spaces F3, 12 October 2026, backend B3). One dialog
 * for all three kinds, opened from a chat's row and its open screen, a
 * folder's row and its page, and a file's row in a space's Folders pill.
 *
 * ── WHICH SPACES ARE OFFERED ───────────────────────────────────────────────
 * The viewer's spaces where they may add: Owner or Contributor
 * (`moveTargets`), team spaces included (techlead decision 1, 12 October
 * 2026), each named by its kind in the badge style the spaces list uses
 * (`spaceKindMark`: "Shared", or "Team" for a viewer with Team Channels). A
 * space where they only view would answer 403, so it is not on the list at
 * all. The unsearched rows come from the `/spaces` list's own baseline entry
 * (`SPACES_BASELINE_PARAMS`), so a reader who has seen their spaces opens this
 * on rows already in hand. The space the item is in now stays on the list,
 * marked, and cannot be picked again.
 *
 * ── NO SILENT CUT (techlead decision 2) ────────────────────────────────────
 * The server sends a page of 30. A search box asks the server (`/spaces`
 * `search`), so a space beyond the first page can be found by name, and when
 * the server says it holds more than the page it sent, a line under the list
 * says so: "Showing 30. Search to find more." (`movePickerCutLine`). The rows
 * on screen stay while a new search is on its way, dimmed, rather than
 * dropping to a skeleton on every keystroke.
 *
 * ── ONE TAP MOVES ──────────────────────────────────────────────────────────
 * Picking a space is the decision, so the tap sends it; a second "Move"
 * button would ask the same question twice. The tapped row shows the wait,
 * every other row is held still while it runs, and the dialog closes when
 * the server has answered and the lists under it have re-read
 * (`useMoveToSpace` returns its invalidation), with a toast naming where the
 * item went.
 *
 * ── REFUSALS ARE SHOWN HERE ────────────────────────────────────────────────
 * Under the list, in the words `moveRefusal` gives each status: a
 * confidential chat is told plainly that it cannot go into a space. The
 * dialog stays open, so the reader can pick again or close it.
 *
 * ── BACK OUT ───────────────────────────────────────────────────────────────
 * "Remove from space" sends `space_uuid: null`: the item comes back to the
 * owner's own items and nothing is deleted. It is offered only when the item
 * names the space it is in (`offersRemoveFromSpace`); a `null` or absent space
 * means the item is the owner's alone, the folder page included since
 * `GET /folders/{uuid}` carries the block (techlead decision 3).
 *
 * Hosts mount this only while it is open, so every open starts clean.
 */
export function MoveToSpaceDialog({
  item,
  open,
  onOpenChange,
  pick,
}: {
  item: SpaceItemTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Bulk select: the dialog moves nothing itself and hands the choice back (a
   * Space, or `null` for "out of its Space"); the screen sends one bulk request
   * for every ticked item. `count` words the dialog for them, and "Take out of
   * the space" is offered because some of them may sit in one.
   */
  pick?: { count: number; onPick: (to: Space | null) => void };
}) {
  const session = useV2Session();
  const move = useMoveToSpace();
  const [error, setError] = useState<string | null>(null);
  // The row the reader picked, so its spinner shows on it and not on all.
  const [pickedUuid, setPickedUuid] = useState<string | null | undefined>(undefined);

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
  const targets = useMemo(() => (rows ? moveTargets(rows) : []), [rows]);
  const cutLine = movePickerCutLine(
    targets.length,
    rows && pagination ? { rows: rows.length, total: pagination.total } : null,
  );

  const noun = SPACE_ITEM_NOUN[item.type];
  const currentUuid = pick ? null : (item.space?.uuid ?? null);
  const inSpace = pick ? true : offersRemoveFromSpace(item);

  const send = (to: Space | null) => {
    if (pick) {
      onOpenChange(false);
      pick.onPick(to);
      return;
    }
    setError(null);
    setPickedUuid(to?.uuid ?? null);
    move.mutate(
      { item, to: to?.uuid ?? null },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success(to ? `Moved to ${to.name}` : 'Taken out of the space', {
            description: to
              ? `Everyone in ${to.name} can open this ${noun}.`
              : `This ${noun} is yours alone again. Nothing was deleted.`,
          });
        },
        onError: (mutationError) => {
          const apiError = extractApiError(mutationError);
          setError(moveRefusal(item.type, apiError.status, apiError.message));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (move.isPending ? undefined : onOpenChange(next))}>
      <DialogContent className={cn('sm:max-w-md', COLLAB_DIALOG_SURFACE)}>
        <DialogHeader>
          <DialogTitle>Move to a space</DialogTitle>
          <DialogDescription>
            {pick
              ? `Everyone in the space you pick can open the ${pick.count} selected. They stay yours.`
              : `Everyone in the space you pick can open “${item.name}”. It stays yours.`}
          </DialogDescription>
        </DialogHeader>

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
            <MoveTargetsSkeleton />
          ) : spacesQuery.isError ? (
            <CollabFailure
              className="mx-2"
              message="Couldn’t load your spaces."
              onRetry={() => void spacesQuery.refetch()}
            />
          ) : targets.length === 0 && search.term ? (
            <div className="px-2 py-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
              <p className="text-sm font-medium text-foreground">
                {`No space you can add to matches “${search.term}”`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another word, or clear the search.
              </p>
            </div>
          ) : targets.length === 0 && cutLine === null ? (
            <div className="px-2 py-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
              <p className="text-sm font-medium text-foreground">No space to move it to</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You can move items into spaces where you are an Owner or Contributor.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/spaces">Go to Spaces</Link>
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
              {targets.map((space) => {
                const isCurrent = space.uuid === currentUuid;
                const isSending = move.isPending && pickedUuid === space.uuid;
                // The list's word for the same person (`spaceRoleWord`).
                const role = spaceRoleWord(space);
                const kind = spaceKindMark(space, teamChannelsOpen);
                return (
                  <li key={space.uuid}>
                    <button
                      type="button"
                      disabled={isCurrent || move.isPending}
                      onClick={() => send(space)}
                      aria-current={isCurrent ? 'true' : undefined}
                      className={cn(
                        'v2-interactive flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary/60 disabled:cursor-default disabled:hover:bg-transparent',
                        move.isPending && !isSending && 'opacity-60',
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
            </ul>
          )}
        </div>

        {cutLine ? (
          <p className="-mt-3 text-xs text-muted-foreground">{cutLine}</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {/* Cancel first in the DOM, outlined, as in the New folder dialog:
            the footer reverses on a phone, so "Remove from space" sits on
            top and Cancel under it, and on a desktop the row is reversed
            back, Remove on the left and Cancel on the right (design round 2). */}
        <DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={move.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {inSpace ? (
            <Button
              type="button"
              variant="outline"
              disabled={move.isPending}
              onClick={() => send(null)}
            >
              {move.isPending && pickedUuid === null ? (
                <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
              ) : (
                <FolderOutput aria-hidden className="size-4" />
              )}
              Remove from space
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Three rows at the picker's exact geometry: crest, name, meta line. */
function MoveTargetsSkeleton() {
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
