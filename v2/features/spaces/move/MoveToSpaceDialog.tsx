'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FolderOutput, Loader2 } from 'lucide-react';
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
import { extractApiError } from '@/lib/utils/api-error';
import type { Space } from '@/types/collab';
import { COLLAB_DIALOG_SURFACE } from '@/v2/features/collab/kit/dialog-surface';
import { useMoveToSpace } from '../content-mutations';
import {
  moveRefusal,
  moveTargets,
  offersRemoveFromSpace,
  SPACE_ITEM_NOUN,
  type SpaceItemTarget,
} from '../content-model';
import { SpacePickList } from './SpacePickList';

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
  const move = useMoveToSpace();
  const [error, setError] = useState<string | null>(null);
  // The row the reader picked, so its spinner shows on it and not on all.
  const [pickedUuid, setPickedUuid] = useState<string | null | undefined>(undefined);

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

        <SpacePickList
          targets={moveTargets}
          onPick={send}
          busyUuid={move.isPending ? (pickedUuid ?? null) : null}
          disabled={move.isPending}
          currentUuid={currentUuid}
          noMatch={(term) => `No space you can add to matches “${term}”`}
          empty={
            <div className="px-2 py-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
              <p className="text-sm font-medium text-foreground">No space to move it to</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You can move items into spaces where you are an Owner or Contributor.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/spaces">Go to Spaces</Link>
              </Button>
            </div>
          }
        />

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
