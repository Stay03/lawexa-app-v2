'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';

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
import { Input } from '@/components/ui/input';
import { extractApiError } from '@/lib/utils/api-error';
import { spaceGameHref } from '@/lib/utils/space-game-href';
import { COLLAB_DIALOG_SURFACE } from '@/v2/features/collab/kit/dialog-surface';
import { useCreateSpace } from '@/v2/features/spaces/mutations';
import { SpacePickList } from '@/v2/features/spaces/move/SpacePickList';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { hostRefusal, hostTargets, quickHostSpacePayload } from './model';
import { useGoLive } from './mutations';
import { spaceRoom } from './quiz-room';

interface PickedSpace {
  uuid: string;
  name: string;
  /** Made a moment ago from the New Space row, whose button shows the wait. */
  isNew?: boolean;
}

/**
 * HostLiveQuizDialog — host a live quiz from outside a Space (Arthur's spec,
 * 9 November 2026: "Host Live Quiz from a Space with a quick Space picker
 * from outside one"; decisions 93142269).
 *
 * The reader's Spaces where they host (`hostTargets`), in the Space list the
 * Move dialog uses (`SpacePickList`). One tap on a Space puts the quiz live
 * there and opens the game on that Space's page, where its members are told.
 * The last row makes a new Space with just a name (`quickHostSpacePayload`)
 * and puts the quiz live in it, in the same tap.
 *
 * A refusal is said under the list and the dialog stays open, so the reader
 * can pick again: a Space with a game already running offers the way into it.
 *
 * Hosts mount this only while it is open, so every open starts clean.
 */
export function HostLiveQuizDialog({
  quiz,
  open,
  onOpenChange,
}: {
  quiz: { uuid: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const goLive = useGoLive(quiz.uuid);
  const createSpace = useCreateSpace();
  /** The Space a press is putting the quiz live in, for its row's wait. */
  const [picked, setPicked] = useState<PickedSpace | null>(null);
  const [refusal, setRefusal] = useState<{ message: string; running: PickedSpace | null } | null>(null);
  /** The new Space's name while its field is open; null while it is the row. */
  const [newName, setNewName] = useState<string | null>(null);
  const busy = goLive.isPending || createSpace.isPending;

  const goLiveIn = (space: PickedSpace) => {
    setRefusal(null);
    setPicked(space);
    goLive.mutate(
      { room: spaceRoom(space.uuid) },
      {
        onSuccess: (response) => {
          onOpenChange(false);
          router.push(spaceGameHref(space.uuid, response.data.uuid));
        },
        onError: (error) => {
          const { status, message } = extractApiError(error);
          setRefusal({
            message: hostRefusal(status, message, space.name),
            running: status === 409 ? { uuid: space.uuid, name: space.name } : null,
          });
        },
      },
    );
  };

  const createAndGoLive = (event: FormEvent) => {
    event.preventDefault();
    const name = newName?.trim() ?? '';
    if (name === '' || busy) return;
    setRefusal(null);
    createSpace.mutate(quickHostSpacePayload(name), {
      onSuccess: (response) => goLiveIn({ uuid: response.data.uuid, name: response.data.name, isNew: true }),
      onError: (error) => setRefusal({ message: extractApiError(error).message, running: null }),
    });
  };

  const newSpace =
    newName === null ? (
      <button
        type="button"
        disabled={busy}
        onClick={() => setNewName('')}
        className={cn(
          'v2-interactive flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-secondary/60 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent',
          FOCUS_RING,
        )}
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground"
        >
          <Plus className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">New Space</span>
          <span className="block truncate text-xs text-muted-foreground">Just a name. Invite people from the game.</span>
        </span>
      </button>
    ) : (
      <form
        onSubmit={createAndGoLive}
        className="flex items-center gap-2 px-2 py-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
      >
        <Input
          autoFocus
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Name the new Space"
          aria-label="New Space name"
          maxLength={100}
          disabled={busy}
        />
        <Button type="submit" size="sm" disabled={busy || newName.trim() === ''} className="shrink-0">
          {createSpace.isPending || (goLive.isPending && picked?.isNew === true) ? (
            <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
          ) : null}
          Create and go live
        </Button>
      </form>
    );

  return (
    <Dialog open={open} onOpenChange={(next) => (busy ? undefined : onOpenChange(next))}>
      <DialogContent className={cn('sm:max-w-md', COLLAB_DIALOG_SURFACE)}>
        <DialogHeader>
          <DialogTitle>Host a live quiz</DialogTitle>
          <DialogDescription>
            {`Pick a Space to run “${quiz.title}” in. Its members are told it’s live and join from there.`}
          </DialogDescription>
        </DialogHeader>

        <SpacePickList
          targets={hostTargets}
          onPick={goLiveIn}
          busyUuid={goLive.isPending ? (picked?.uuid ?? null) : null}
          disabled={busy}
          noMatch={(term) => `No Space you host in matches “${term}”`}
          empty={
            <div className="flex flex-col gap-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
              <p className="px-2 pt-2 text-sm text-muted-foreground">
                You don’t host in a Space yet. Make one to run the quiz in.
              </p>
              {newSpace}
            </div>
          }
          after={newSpace}
        />

        {refusal ? (
          <p role="alert" className="text-sm text-destructive">
            {refusal.message}{' '}
            {refusal.running ? (
              <Link
                href={`/spaces/${refusal.running.uuid}`}
                onClick={() => onOpenChange(false)}
                className={cn('rounded font-medium text-foreground underline underline-offset-4', FOCUS_RING)}
              >
                Open {refusal.running.name}
              </Link>
            ) : null}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
