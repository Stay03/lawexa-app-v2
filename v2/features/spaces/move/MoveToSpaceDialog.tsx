'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
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
import { CONTENT_ROLE_LABELS } from '@/v2/features/collab/membership/content-role';
import { CollabFailure } from '@/v2/features/collab/kit/CollabFailure';
import { SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { collabAccessState } from '@/v2/features/collab/model';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useMoveToSpace } from '../content-mutations';
import {
  moveRefusal,
  moveTargets,
  SPACE_ITEM_NOUN,
  type SpaceItemTarget,
} from '../content-model';
import { spaceOwnerLabel } from '../model';
import { SPACES_BASELINE_PARAMS, spacesQueries } from '../queries';

/**
 * MoveToSpaceDialog — put an item the viewer owns into one of their spaces,
 * or take it back out (Spaces F3, 12 October 2026, backend B3). One dialog
 * for all three kinds, opened from a chat's row and its open screen, a
 * folder's row and its page, and a file's row in a space's Files tab.
 *
 * ── WHICH SPACES ARE OFFERED ───────────────────────────────────────────────
 * The viewer's spaces where they may add: Owner or Contributor
 * (`moveTargets`). A space where they only view would answer 403, so it is
 * not on the list at all. The rows come from the `/spaces` list's own
 * baseline entry (`SPACES_BASELINE_PARAMS`), so a reader who has seen their
 * spaces opens this on rows already in hand. The space the item is in now
 * stays on the list, marked, and cannot be picked again.
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
 * owner's own items and nothing is deleted. It is offered whenever the item
 * is in a space, or may be (a folder page cannot tell: `GET /folders/{uuid}`
 * carries no space), and not when it is known to be the owner's alone.
 *
 * Hosts mount this only while it is open, so every open starts clean.
 */
export function MoveToSpaceDialog({
  item,
  open,
  onOpenChange,
}: {
  item: SpaceItemTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const session = useV2Session();
  const move = useMoveToSpace();
  const [error, setError] = useState<string | null>(null);
  // The row the reader picked, so its spinner shows on it and not on all.
  const [pickedUuid, setPickedUuid] = useState<string | null | undefined>(undefined);

  const spacesQuery = useQuery({
    ...spacesQueries.list({ viewerId: session.userId, ...SPACES_BASELINE_PARAMS }),
    enabled: collabAccessState(session) === 'eligible',
  });
  const rows = spacesQuery.data?.data;
  const targets = useMemo(() => (rows ? moveTargets(rows) : []), [rows]);

  const noun = SPACE_ITEM_NOUN[item.type];
  const currentUuid = item.space?.uuid ?? null;
  const mayBeInSpace = item.space !== null;

  const send = (to: Space | null) => {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move to a space</DialogTitle>
          <DialogDescription>
            {`Everyone in the space you pick can open “${item.name}”. It stays yours.`}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-2 max-h-[min(22rem,55vh)] overflow-y-auto overscroll-contain">
          {spacesQuery.isPending ? (
            <MoveTargetsSkeleton />
          ) : spacesQuery.isError ? (
            <CollabFailure
              className="mx-2"
              message="Couldn’t load your spaces."
              onRetry={() => void spacesQuery.refetch()}
            />
          ) : targets.length === 0 ? (
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
                const role = space.my_content_role
                  ? CONTENT_ROLE_LABELS[space.my_content_role]
                  : null;
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
                        <span className="block truncate text-sm font-medium text-foreground">
                          {space.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[role, spaceOwnerLabel(space)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      {isSending ? (
                        <Loader2 aria-hidden className="size-4 shrink-0 text-muted-foreground motion-safe:animate-spin" />
                      ) : isCurrent ? (
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <Check aria-hidden className="size-3.5" />
                          In it now
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          {mayBeInSpace ? (
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
          ) : (
            <span aria-hidden />
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={move.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
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
