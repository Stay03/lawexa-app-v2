'use client';

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
import { useDeleteConversation } from './mutations';

/**
 * DeleteConversationDialog — the one confirm for deleting a chat, shared by the
 * `/conversations` row menu and the open chat's header menu, so the copy and
 * the refusal handling cannot drift apart.
 *
 * THE DIALOG OUTLIVES THE REQUEST. `preventDefault` on the action stops Radix's
 * auto-close, so the button can show its pending state and a refusal can be
 * read in place. A dismiss is ignored while the request runs.
 *
 * THE HOST CLOSES IT ON SUCCESS, through `onDeleted`. The list closes it and
 * collapses the row; the open chat leaves the route and lets the unmount close
 * it, which is why a finished delete keeps the button disabled rather than
 * offering a second press on a chat that is gone.
 *
 * A REFUSAL SHOWS THE SERVER'S SENTENCE. A 4xx is a reason the API explained
 * (a chat that runs a Radar must lose the Radar first); a 5xx or a dropped
 * connection carries no useful sentence, so it gets the designed copy.
 */
export function DeleteConversationDialog({
  conversationId,
  open,
  onOpenChange,
  onDeleted,
}: {
  /** `null` while no chat is targeted (the list's closed state). */
  conversationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs once the server confirms, before the caches drop the chat. */
  onDeleted: (conversationId: string) => void;
}) {
  const deleteConversation = useDeleteConversation({
    onDeleted: (id) => {
      toast.success('Chat deleted');
      onDeleted(id);
    },
  });

  // One mutation serves every row of the list, so its state only counts for
  // the chat this dialog is about now.
  const forThisChat =
    conversationId !== null && deleteConversation.variables === conversationId;
  const busy =
    forThisChat && (deleteConversation.isPending || deleteConversation.isSuccess);
  const apiError =
    forThisChat && deleteConversation.error
      ? extractApiError(deleteConversation.error)
      : null;
  const errorMessage = apiError
    ? apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : "Couldn't delete this chat. Try again."
    : null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        // A dismissed refusal must not greet the next open.
        if (!next) deleteConversation.reset();
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
          <AlertDialogDescription>
            It disappears from your chats. This can&apos;t be undone from the
            app.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage ? (
          <p
            role="alert"
            className="text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {errorMessage}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={(event) => {
              event.preventDefault();
              if (conversationId === null || busy) return;
              deleteConversation.mutate(conversationId);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
