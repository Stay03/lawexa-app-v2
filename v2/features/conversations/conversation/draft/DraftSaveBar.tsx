'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Editor } from '@tiptap/react';
import { Check, FolderPlus, Loader2, NotebookPen } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ConversationSpaceRef } from '@/types/chat';
import { ACTION_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { FolderPicker } from '@/v2/features/folders/picker/FolderPicker';
import { ExportMenu } from '@/v2/features/notes/reader/NoteActions';
import { readSavedDraftNote } from './draft-edits';
import { saveFailureSentence } from './draft-save-failure';
import { useSaveDraftNote } from './use-save-draft-note';

/**
 * DraftSaveBar — the draft panel's foot (the draft editor, Stay 23 October
 * 2026): Save as note, then, once it is a note, what a note offers.
 *
 *   before   Save as note
 *   after    "Saved to your notes" · Open note · Export (Word, PDF) · Save to folder
 *   edited   Save changes, beside the same links
 *
 * Save to folder opens the folder picker on this Space's folders in a Space
 * chat, else on the reader's own. Export is the note page's own menu, so the
 * Word and PDF files come from the saved note with its fonts (backend
 * 9051f52a). A failed save says why under the button, never in a toast the
 * reader may miss.
 */
export function DraftSaveBar({
  editor,
  conversationId,
  ordinal,
  title,
  dirty,
  onSaved,
  space,
}: {
  editor: Editor;
  conversationId: string;
  ordinal: number;
  title: string;
  /** The draft changed since its last save (or was never saved). */
  dirty: boolean;
  onSaved: () => void;
  space: ConversationSpaceRef | null;
}) {
  const save = useSaveDraftNote(conversationId, ordinal);
  const [folderOpen, setFolderOpen] = useState(false);
  const saved = readSavedDraftNote(conversationId, ordinal);

  const press = () => {
    if (save.isPending) return;
    save.mutate({ title, html: editor.getHTML() }, { onSuccess: onSaved });
  };

  return (
    <div className="sticky bottom-0 z-10 border-t border-border/70 bg-popover/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm xl:px-5">
      <div className="flex flex-wrap items-center gap-2">
        {saved && !dirty ? (
          <span className="inline-flex h-10 items-center gap-1.5 pr-1 text-sm font-medium text-muted-foreground">
            <Check aria-hidden className="size-4 text-primary" />
            Saved to your notes
          </span>
        ) : (
          <button
            type="button"
            onClick={press}
            aria-disabled={save.isPending}
            className={cn(
              'v2-interactive inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90',
              FOCUS_RING,
            )}
          >
            {save.isPending ? (
              <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
            ) : (
              <NotebookPen aria-hidden className="size-4" />
            )}
            <span aria-live="polite">{save.isPending ? 'Saving…' : saved ? 'Save changes' : 'Save as note'}</span>
          </button>
        )}
        {saved ? (
          <>
            <Link href={`/notes/${saved.slug}`} className={cn(ACTION_PILL, FOCUS_RING)}>
              Open note
            </Link>
            <ExportMenu slug={saved.slug} />
            <button
              type="button"
              onClick={() => setFolderOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={folderOpen}
              className={cn(ACTION_PILL, FOCUS_RING)}
            >
              <FolderPlus aria-hidden className="size-4" />
              {space ? 'Save to Space folder' : 'Save to folder'}
            </button>
          </>
        ) : null}
      </div>
      {save.isError ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {saveFailureSentence(save.error)}
        </p>
      ) : null}
      {saved ? (
        <FolderPicker
          target={{ type: 'note', contentId: saved.id }}
          title={space ? 'Save to Space folder' : 'Save to folder'}
          space={space ?? undefined}
          open={folderOpen}
          onOpenChange={setFolderOpen}
        />
      ) : null}
    </div>
  );
}
