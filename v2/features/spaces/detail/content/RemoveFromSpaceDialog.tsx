'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { extractApiError } from '@/lib/utils/api-error';
import { COLLAB_DIALOG_SURFACE } from '@/v2/features/collab/kit/dialog-surface';
import { useMoveToSpace, useRemoveFromSpace } from '../../content-mutations';
import {
  removeRefusal,
  SPACE_ITEM_NOUN,
  type SpaceItemTarget,
} from '../../content-model';

/**
 * RemoveFromSpaceDialog — the space Owner's confirm before an item leaves the
 * space (Spaces F3, 12 October 2026, `DELETE /spaces/{uuid}/items`).
 *
 * IT SAYS WHAT HAPPENS AND WHAT DOES NOT. "Remove" next to someone else's
 * work reads like delete, and it is not: the item goes back to the person who
 * owns it, untouched. So the sentence says both halves, and the button says
 * "Remove from space", never "Delete" or a bare "Remove".
 *
 * It is a confirm and not an undo because the request is the decision of a
 * person acting on someone else's work, and the owner will see their item
 * leave the space; a six-second window would not change who sees what.
 * A refusal (403 for anyone but the Owner, 404 when the item already left)
 * is shown in place and the dialog stays open.
 *
 * ── TWO WAYS OUT FOR A CHAT (Arthur's menu, 15 October 2026) ──────────────
 * The chat's own owner takes it out with the move route (`route: 'detach'`,
 * `space_uuid: null`); the space's Owner takes a member's chat out through the
 * space (`'space-item'`, the default). Either way the chat goes back to its
 * owner's own chats, and the files sent in it stay in the space, so the
 * sentence says that too.
 *
 * Hosts mount this only while it is open, so each open starts clean.
 */
export function RemoveFromSpaceDialog({
  spaceUuid,
  spaceName,
  item,
  route = 'space-item',
  open,
  onOpenChange,
}: {
  spaceUuid: string;
  spaceName: string;
  item: SpaceItemTarget;
  /** `detach`: the chat's own owner takes it out (see the docblock). */
  route?: 'space-item' | 'detach';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const removeItem = useRemoveFromSpace(spaceUuid);
  const detach = useMoveToSpace();
  const pending = removeItem.isPending || detach.isPending;
  const [error, setError] = useState<string | null>(null);
  const noun = SPACE_ITEM_NOUN[item.type];
  const yours = route === 'detach';

  const handlers = {
    onSuccess: () => {
      onOpenChange(false);
      toast.success(`Removed from ${spaceName}`, {
        description:
          item.type === 'file'
            ? `“${item.name}” was not deleted. It is in your own files now.`
            : item.type === 'conversation'
              ? `“${item.name}” was not deleted. It is back in ${yours ? 'your' : 'its owner’s'} own chats.`
              : `“${item.name}” was not deleted. It is back with the person who added it.`,
      });
    },
    onError: (mutationError: unknown) =>
      setError(removeRefusal(extractApiError(mutationError).status)),
  };

  const confirm = () => {
    setError(null);
    if (yours) detach.mutate({ item, to: null }, handlers);
    else removeItem.mutate(item, handlers);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}
    >
      <AlertDialogContent className={COLLAB_DIALOG_SURFACE}>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Remove “${item.name}” from this space?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {item.type === 'file'
              ? `This takes the file out of ${spaceName}, so members no longer see it here. It is not deleted: a space's file belongs to the space, so it moves to your own files.`
              : item.type === 'conversation'
                ? `This takes the chat out of ${spaceName}, so members no longer see it here. It is not deleted: it goes back to ${yours ? 'your' : 'its owner’s'} own chats. Files sent in it stay in the space.`
                : `This takes the ${noun} out of ${spaceName}, so members no longer see it here. It is not deleted: it goes back to the person who added it.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Held open until the server answers, so a refusal can be read.
              event.preventDefault();
              confirm();
            }}
            disabled={pending}
          >
            {pending ? (
              <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
            ) : null}
            Remove from space
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
