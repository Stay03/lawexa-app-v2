'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generateJSON } from '@tiptap/core';
import { Loader2, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/utils';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { useV2Session } from '@/v2/runtime/session-context';
import { createNoteExtensions } from '@/v2/features/notes/editor/extensions';
import { createCaseMentionStore } from '@/v2/features/notes/editor/mention-store';
import { notesApi } from '@/v2/features/notes/api';
import { notesQueries } from '@/v2/features/notes/queries';
import type { NoteRevision } from '@/v2/features/notes/types';
import { extractApiError } from '@/lib/utils/api-error';
import { diffDocs, hasChanges } from './draft-diff';
import { revisionAuthorLabel } from './draft-note-state';
import { ADDED_WORDS, DiffDocument, REMOVED_WORDS } from './DraftChangesView';

/**
 * DraftHistoryDialog — a draft note's saved versions (drafts saved as notes,
 * thread 1e44eb39): every version Lawexa wrote, and the reader's text kept
 * just before a Lawexa version replaced it. Newest first, each named by who
 * wrote it ("Lawexa · Version 3", "You", a Space member) and when.
 *
 * Choosing one shows it against the draft as it is now, marked as "Show
 * changes" marks a version (draft-diff.ts): what restoring it would take out,
 * struck through, and what it would put back, underlined. Any version
 * restores, Lawexa's newest too (the reader may have edited it since). Restore
 * asks first, then saves that version as the reader's new text; the server
 * keeps the text now as a revision first, so a restore is never a loss. Only a reader who may edit the
 * note restores, and only once the draft's own edits are saved.
 */
export function DraftHistoryDialog({
  open,
  onOpenChange,
  noteId,
  canRestore,
  current,
  saving = false,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: number;
  /** The reader may edit the note. */
  canRestore: boolean;
  /** The draft's text as it is now (HTML), or `null` before the editor is made. */
  current: (() => string) | null;
  /** The draft's own edits are still saving: a restore waits for them. */
  saving?: boolean;
  /** After a restore: the panel reads the note again and opens on it. */
  onRestored?: () => void;
}) {
  const { userUuid } = useV2Session();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState<NoteRevision | null>(null);
  const [asking, setAsking] = useState(false);
  const list = useQuery({ ...notesQueries.revisions({ id: noteId, page }), enabled: open });

  const restore = useMutation({
    mutationFn: (revision: number) => notesApi.restoreRevision(noteId, revision),
    meta: { silentError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...notesQueries.all, 'draft-notes'] });
      void queryClient.invalidateQueries({ queryKey: [...notesQueries.all, 'revisions', noteId] });
      setAsking(false);
      setChosen(null);
      onOpenChange(false);
      onRestored?.();
    },
  });

  const rows = list.data?.data ?? [];
  const pagination = list.data?.pagination;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setChosen(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Every version Lawexa wrote, and your text from just before each new one. Restoring one keeps the rest.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-4 sm:grid-cols-[15rem_1fr]">
          <div className="min-h-0 overflow-y-auto rounded-lg border">
            {list.isPending ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : list.isError ? (
              <div className="space-y-2 p-3 text-sm text-muted-foreground">
                <p role="alert">The history didn’t load.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void list.refetch()}>
                  Try again
                </Button>
              </div>
            ) : (
              <ol aria-label="Versions">
                {rows.map((row) => (
                  <li key={row.revision}>
                    <button
                      type="button"
                      aria-current={chosen?.revision === row.revision ? 'true' : undefined}
                      onClick={() => setChosen(row)}
                      className={cn(
                        'v2-interactive flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-secondary/60',
                        chosen?.revision === row.revision && 'bg-secondary',
                        FOCUS_RING,
                      )}
                    >
                      <span className="font-medium text-foreground">
                        {revisionAuthorLabel(row, userUuid)}
                      </span>
                      <RevisionTime at={row.created_at} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {pagination && pagination.last_page > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t p-2 text-xs text-muted-foreground">
                <Button type="button" variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Newer
                </Button>
                <span>
                  {page} of {pagination.last_page}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={page >= pagination.last_page}
                  onClick={() => setPage(page + 1)}
                >
                  Older
                </Button>
              </div>
            ) : null}
          </div>
          <div className="min-h-0 overflow-y-auto rounded-lg border p-4">
            {chosen ? (
              <RevisionAgainstNow noteId={noteId} revision={chosen} current={current} />
            ) : (
              <p className="text-sm text-muted-foreground">Choose a version to see it against the draft as it is now.</p>
            )}
          </div>
        </div>
        {/* Any version restores, the newest too: once the reader has edited it,
            Lawexa's newest version is not the text now (Frontend's review). */}
        {chosen && canRestore ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {saving ? <span className="text-xs text-muted-foreground">Saving your last edits first…</span> : null}
            <Button type="button" onClick={() => setAsking(true)} disabled={saving || restore.isPending}>
              <RotateCcw aria-hidden className="mr-1.5 size-4" />
              Restore this version
            </Button>
          </div>
        ) : null}
      </DialogContent>

      <AlertDialog open={asking} onOpenChange={(next) => (next ? null : setAsking(false))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              {chosen ? `${revisionAuthorLabel(chosen, userUuid)} becomes the draft’s text. ` : ''}
              The draft as it is now stays in the history, and Lawexa works from the restored text.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {restore.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {extractApiError(restore.error).message}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restore.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (chosen) restore.mutate(chosen.revision);
              }}
              disabled={restore.isPending}
            >
              {restore.isPending ? <Loader2 aria-hidden className="mr-2 size-4 motion-safe:animate-spin" /> : null}
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

/** "12 minutes ago", read once: the clock is never read in a render body. */
function RevisionTime({ at }: { at: string }) {
  const [now] = useState(() => Date.now());
  const relative = formatRelativeTime(at, now);
  return (
    <time dateTime={at} className="text-xs text-muted-foreground">
      {relative === '' || relative === 'now' ? 'Just now' : `${relative} ago`}
    </time>
  );
}

/** One version against the draft now: what a restore would take out and put back. */
function RevisionAgainstNow({
  noteId,
  revision,
  current,
}: {
  noteId: number;
  revision: NoteRevision;
  current: (() => string) | null;
}) {
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();
  const one = useQuery(notesQueries.revision({ id: noteId, revision: revision.revision }));
  // The note editor's own schema, so both texts read as the editor reads them.
  const [extensions] = useState(() =>
    createNoteExtensions({ placeholder: '', mentionStore: createCaseMentionStore({ queryClient, viewerId }) }),
  );
  const then = one.data?.data.content;
  const [now] = useState(() => current?.() ?? '');
  const diff = useMemo(
    () => (then === undefined ? null : diffDocs(generateJSON(now, extensions), generateJSON(then, extensions))),
    [then, now, extensions],
  );

  if (one.isPending) return <Skeleton className="h-48 w-full" />;
  if (one.isError || !diff) return <p role="alert" className="text-sm text-muted-foreground">This version didn’t load.</p>;
  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {hasChanges(diff) ? (
          <>
            <span>Restoring it would:</span>
            <span>
              <ins className={ADDED_WORDS}>put back</ins>
            </span>
            <span>
              <del className={REMOVED_WORDS}>take out</del>
            </span>
          </>
        ) : (
          <span>The same as the draft now.</span>
        )}
      </p>
      <DiffDocument diff={diff} className="text-[15px]" />
    </div>
  );
}
