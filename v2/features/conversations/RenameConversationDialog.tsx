'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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
import { useRenameConversation } from './mutations';

/** The longest title the server keeps (the contract asked of backend). */
const TITLE_MAX = 120;

/**
 * RenameConversationDialog — the open chat's "Rename chat" (long-list #12).
 *
 * The field opens on the current title, selected, so typing replaces it. Save
 * is offered only for a changed, non-empty title. Like the delete confirm, the
 * dialog outlives the request: it shows the pending state, reads a refusal in
 * place, and closes only once the server has stored the new title.
 */
export function RenameConversationDialog({
  conversationId,
  currentTitle,
  open,
  onOpenChange,
  onRenamed,
}: {
  conversationId: string;
  currentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: (title: string) => void;
}) {
  const [title, setTitle] = useState(currentTitle);
  const rename = useRenameConversation({
    onRenamed: (stored) => {
      toast.success('Chat renamed');
      onRenamed(stored);
      onOpenChange(false);
    },
  });

  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && trimmed !== currentTitle.trim() && !rename.isPending;
  const apiError = rename.error ? extractApiError(rename.error) : null;
  const errorMessage = apiError
    ? apiError.status >= 400 && apiError.status < 500
      ? apiError.message
      : "Couldn't rename this chat. Try again."
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (rename.isPending) return;
        if (!next) rename.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) rename.mutate({ conversationId, title: trimmed });
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription>The new name shows in your chats and at the top of this one.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={title}
            maxLength={TITLE_MAX}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Chat name"
            aria-invalid={errorMessage ? true : undefined}
          />
          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={rename.isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {rename.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
