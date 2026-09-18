'use client';

import { useState } from 'react';
import { CornerDownRight, Loader2, Pencil, Trash2 } from 'lucide-react';

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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatFullTimestamp } from '@/lib/utils/collab';
import type { Message } from '@/types/collab';

import { LawexaMessageContent } from './LawexaMessageContent';
import { MessageAttachmentList } from './MessageAttachmentList';

interface MessageRowProps {
  message: Message;
  canEdit: boolean;
  canDelete: boolean;
  /**
   * True only for a genuinely-new tail message (the user's own send or an
   * incoming realtime message) — animates the row in with a subtle fade + rise.
   * Never set for history or older prepended pages.
   */
  animateEntry?: boolean;
  /**
   * True only for a just-arrived Lawexa (`is_ai`) reply — reveals its markdown
   * blocks block-by-block. Ignored for non-AI rows.
   */
  animateReveal?: boolean;
  /** Rejects on failure so the row can stay in edit mode. */
  onSaveEdit: (messageUuid: string, content: string) => Promise<void>;
  onDelete: (messageUuid: string) => void;
}

/** One message line with hover edit/delete actions and inline editing. */
export function MessageRow({
  message,
  canEdit,
  canDelete,
  animateEntry: animateEntryInitial = false,
  animateReveal: animateRevealInitial = false,
  onSaveEdit,
  onDelete,
}: MessageRowProps) {
  // Freeze the entry/reveal decision at mount. The row is keyed by uuid, so it
  // mounts once per message; the parent flips these props to false right after
  // the first paint (its "already-animated" guard), which would otherwise strip
  // the class and snap a still-running animation whenever any sibling re-renders
  // (typing, presence, another message) within the ~300ms window.
  const [animateEntry] = useState(animateEntryInitial);
  const [animateReveal] = useState(animateRevealInitial);
  const [isEditing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [isSaving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const saveEdit = async () => {
    const content = draft.trim();
    if (!content || content === message.content) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSaveEdit(message.uuid, content);
      setEditing(false);
    } catch {
      // Parent surfaces the error toast; keep the draft so the user can retry.
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="rounded-md border bg-background p-2">
        <textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              saveEdit();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setEditing(false);
            }
          }}
          rows={2}
          maxLength={8000}
          className="w-full resize-none bg-transparent text-sm outline-none"
        />
        <div className="mt-1 flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={saveEdit} disabled={isSaving || !draft.trim()}>
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group/msg relative -mx-2 rounded px-2 py-0.5 hover:bg-muted/40',
        animateEntry && 'animate-in fade-in slide-in-from-bottom-2 duration-300'
      )}
    >
      {message.parent_message_uuid && (
        <span className="mb-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <CornerDownRight className="h-3 w-3" />
          Reply
        </span>
      )}
      {/* A message sent from v2 can be nothing but files (backend,
          2026-08-05), and `content` is then `""` — which the text renderer
          would turn into a blank line of body height above them. */}
      {/* MARKDOWN FOR EVERY MESSAGE, FROM ANYONE. Slack and Discord both render
          their markdown for every writer with no special group, and the owner
          asked for the same here: "if i paste a markdown text it shows as
          normal text because im not part of the special group. i dont think
          thats a good fix."

          THE OBJECTION THAT JUSTIFIED THE TWO-TIER VERSION WAS WRONG. The worry
          was that somebody typing an asterisk would see their words rewritten.
          Measured against this tree's own pipeline (remark-gfm + remark-breaks)
          on 18 Sep 2026:

            3 * 4 * 5        unchanged, spaced markers stay literal
            a_variable_name  unchanged, underscores inside a word do not emphasise
            *maybe           unchanged, an unpaired marker stays a marker
            CA/J/28/95       unchanged
            #3 on the list   unchanged, a heading needs a space after the hash
            > quoted         becomes a blockquote
            1. / 2. lines    become a list
            bare URL         becomes a link

          Unbalanced and badly spaced markers rendering literally IS the escape
          mechanism, and it is what both of those products rely on.

          WHAT IT COSTS, and this part is real: runs of spaces collapse, because
          the prose container leaves `white-space` at its default. A
          space-aligned table loses its columns unless it is fenced in ``` or
          indented four spaces, either of which becomes a code block and keeps
          every space. Line breaks survive regardless — remark-breaks turns each
          newline into a hard break, checked on the parsed tree rather than
          assumed.

          `body_format` NO LONGER DECIDES ANYTHING HERE. Every message carries
          it and human messages all carry `'plain'` (measured over 30 messages,
          17 Sep), so honouring it would have meant markdown for nobody but the
          assistant. It stays on the type as a record of what the server sends.
          `is_ai` survives only for the reveal animation, which belongs to a
          just-arrived Lawexa reply and to nothing else. */}
      {message.content !== '' && (
        <LawexaMessageContent
          content={message.content}
          metadata={message.metadata}
          animateReveal={animateReveal}
        />
      )}
      {/* AND IT CAN END UP WITH NEITHER. Delete the only attachment of a
          file-only message and the server keeps the message, serving it back
          with `content: ""` and `attachments: []` — measured on production,
          2026-08-05. With no text and no files this row rendered nothing at
          all: an author and a timestamp over empty space, which reads as a
          message that failed to load rather than one there is nothing left in.
          Muted italics so the line cannot be mistaken for somebody's words.

          THE SAME SENTENCE IS IN v2's `v2/features/channels/feed/
          MessageRow.tsx`. v1 may not import from v2 (the boundary rule), so
          the words are duplicated on purpose and must move together. */}
      {message.content === '' &&
        !(message.attachments && message.attachments.length > 0) && (
          <p className="text-sm text-muted-foreground italic">
            Nothing left to show in this message.
          </p>
        )}
      {message.edited_at && (
        <span
          className="ml-1 text-[11px] text-muted-foreground"
          title={formatFullTimestamp(message.edited_at)}
        >
          (edited)
        </span>
      )}
      {message.attachments && message.attachments.length > 0 && (
        <MessageAttachmentList attachments={message.attachments} />
      )}

      {(canEdit || canDelete) && (
        <div className="absolute -top-3 right-1 hidden overflow-hidden rounded-md border bg-background shadow-sm group-hover/msg:flex">
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setDraft(message.content);
                setEditing(true);
              }}
              className="p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Edit message"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              aria-label="Delete message"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the message for everyone in the channel. This can&apos;t
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(message.uuid)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
