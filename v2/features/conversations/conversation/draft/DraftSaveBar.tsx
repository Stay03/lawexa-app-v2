'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Editor } from '@tiptap/react';
import { ArrowUpRight, Check, Download, FolderPlus, Loader2, MoreHorizontal, NotebookPen } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { ConversationSpaceRef } from '@/types/chat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ACTION_PILL, FOCUS_RING } from '@/v2/shell/designs/modules';
import { FolderPicker } from '@/v2/features/folders/picker/FolderPicker';
import { ExportMenu } from '@/v2/features/notes/reader/NoteActions';
import { PILL_TRIGGER } from '@/v2/features/notes/editor/ToolbarButton';
import { useNoteExport } from '@/v2/features/notes/use-note-export';
import { readSavedDraftNote } from './draft-edits';
import { saveFailureSentence } from './draft-save-failure';
import { useSaveDraftNote } from './use-save-draft-note';

/**
 * Save as note, from the draft panel (the draft editor, Stay 23 October 2026),
 * then, once it is a note, what a note offers. One save (`useDraftSave`) and
 * one folder picker, drawn in one of two places by width:
 *
 *   phone sheet   the panel's foot (DraftSaveBar): Save as note, then
 *                 "Saved to your notes" · Open note · Export (Word, PDF) ·
 *                 Save to folder
 *   computer      the right of the panel's one bar, before the close
 *                 (DraftSaveControl, take B2, Stay 24 October 2026: "add save
 *                 to that toolbar"): the gold Save as note, the panel's only
 *                 primary action, "Save" on a narrow panel; once saved a
 *                 quiet "Saved" chip and a ··· menu with Open note, Export
 *                 Word, Export PDF and Save to folder
 *   edited        Save changes in place of the chip or the line, with the
 *                 same links
 *
 * Save to folder opens the folder picker on this Space's folders in a Space
 * chat, else on the reader's own. Export is the note page's own download
 * (`useNoteExport`), so the Word and PDF files come from the saved note with
 * its fonts (backend 9051f52a). A failed save says why beside the button,
 * never in a toast the reader may miss.
 */
export function useDraftSave({
  editor,
  conversationId,
  ordinal,
  title,
  onSaved,
}: {
  /** `null` until the editor is made; Save is drawn only once it is. */
  editor: Editor | null;
  conversationId: string;
  ordinal: number;
  title: string;
  onSaved: () => void;
}) {
  const mutation = useSaveDraftNote(conversationId, ordinal);
  const [folderOpen, setFolderOpen] = useState(false);
  const saved = readSavedDraftNote(conversationId, ordinal);

  const press = () => {
    if (!editor || mutation.isPending) return;
    mutation.mutate({ title, html: editor.getHTML() }, { onSuccess: onSaved });
  };

  return { mutation, saved, press, folderOpen, setFolderOpen };
}

export type DraftSave = ReturnType<typeof useDraftSave>;

/**
 * The draft panel's menus: its own surface (draft-panel.css), as wide as the
 * longest row so no row wraps, and never wider than the screen.
 */
export const DRAFT_MENU = 'v2-draft-menu w-max min-w-56 max-w-[calc(100vw-1rem)]';

interface DraftSaveProps {
  draft: DraftSave;
  /** The draft changed since its last save (or was never saved). */
  dirty: boolean;
  space: ConversationSpaceRef | null;
}

function folderLabel(space: ConversationSpaceRef | null): string {
  return space ? 'Save to Space folder' : 'Save to folder';
}

function saveLabel(draft: DraftSave): string {
  if (draft.mutation.isPending) return 'Saving…';
  return draft.saved ? 'Save changes' : 'Save as note';
}

/** The bar's word on a panel under 37.5rem, where the formatting needs the room. */
function shortSaveLabel(draft: DraftSave): string {
  return draft.mutation.isPending ? 'Saving…' : 'Save';
}

/** The phone sheet's foot. Not drawn on a computer, where the title line holds Save. */
export function DraftSaveBar({ draft, dirty, space }: DraftSaveProps) {
  const { saved, mutation } = draft;
  return (
    <div className="sticky bottom-0 z-10 border-t border-border/70 bg-popover/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm xl:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {saved && !dirty ? (
          <span className="inline-flex h-10 items-center gap-1.5 pr-1 text-sm font-medium text-muted-foreground">
            <Check aria-hidden className="size-4 text-primary" />
            Saved to your notes
          </span>
        ) : (
          <button
            type="button"
            onClick={draft.press}
            aria-disabled={mutation.isPending}
            className={cn(
              'v2-interactive inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90',
              FOCUS_RING,
            )}
          >
            {mutation.isPending ? (
              <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
            ) : (
              <NotebookPen aria-hidden className="size-4" />
            )}
            <span aria-live="polite">{saveLabel(draft)}</span>
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
              onClick={() => draft.setFolderOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={draft.folderOpen}
              className={cn(ACTION_PILL, FOCUS_RING)}
            >
              <FolderPlus aria-hidden className="size-4" />
              {folderLabel(space)}
            </button>
          </>
        ) : null}
      </div>
      {mutation.isError ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {saveFailureSentence(mutation.error)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The right of the computer's bar: the gold Save as note (or Save changes),
 * or once saved the quiet chip, then the ··· menu once there is a note. A
 * failed save says why in a small box under the button. Inside the panel's
 * `@container/draft`.
 */
export function DraftSaveControl({ draft, dirty, space }: DraftSaveProps) {
  const { saved, mutation } = draft;
  return (
    <div className="relative hidden shrink-0 items-center gap-0.5 xl:flex">
      {saved && !dirty ? (
        <span className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-primary/12 px-2.5 text-[13px] font-semibold text-primary">
          <Check aria-hidden className="size-[15px]" />
          Saved
        </span>
      ) : (
        <button
          type="button"
          onClick={draft.press}
          aria-disabled={mutation.isPending}
          className={cn(
            'v2-interactive inline-flex h-8 items-center gap-1.75 rounded-[9px] bg-primary pr-3.25 pl-2.75 text-[13px] font-semibold whitespace-nowrap text-primary-foreground',
            'shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.15)] transition-colors hover:bg-primary/90',
            FOCUS_RING,
          )}
        >
          {mutation.isPending ? (
            <Loader2 aria-hidden className="size-[15px] motion-safe:animate-spin" />
          ) : (
            <NotebookPen aria-hidden className="size-[15px]" />
          )}
          <span aria-live="polite">
            <span className="@max-[37.5rem]/draft:hidden">{saveLabel(draft)}</span>
            <span className="hidden @max-[37.5rem]/draft:inline">{shortSaveLabel(draft)}</span>
          </span>
        </button>
      )}
      {saved ? (
        <SavedNoteMenu
          slug={saved.slug}
          dirty={dirty}
          folder={folderLabel(space)}
          onFolder={() => draft.setFolderOpen(true)}
        />
      ) : null}
      {mutation.isError ? (
        <p
          role="alert"
          className="v2-draft-surface absolute top-full right-0 z-30 mt-1.5 w-64 rounded-lg px-3 py-2 text-xs leading-snug text-destructive"
        >
          {saveFailureSentence(mutation.error)}
        </p>
      ) : null}
    </div>
  );
}

/** The saved note's menu: Open note, the two exports, then Save to folder. */
function SavedNoteMenu({
  slug,
  dirty,
  folder,
  onFolder,
}: {
  slug: string;
  dirty: boolean;
  folder: string;
  onFolder: () => void;
}) {
  const { download, exporting } = useNoteExport(slug);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger aria-label="Saved note" className={cn(PILL_TRIGGER, 'size-7.5', FOCUS_RING)}>
            {exporting ? (
              <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
            ) : (
              <MoreHorizontal aria-hidden className="size-[17px]" />
            )}
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Saved note
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className={DRAFT_MENU}>
        <DropdownMenuLabel className="px-2.5 pt-2 pb-1.5 text-[11.5px]">
          <span className="mb-px block text-[12.5px] font-semibold text-foreground">Saved to your notes</span>
          {dirty ? 'Your later edits are not in it yet.' : 'Save changes appears when you edit.'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/notes/${slug}`}>
            <ArrowUpRight aria-hidden className="size-4 text-foreground/62" />
            Open note
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={exporting} onSelect={() => void download('docx')}>
          <Download aria-hidden className="size-4 text-foreground/62" />
          Export Word
          <DropdownMenuShortcut>.docx</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={exporting} onSelect={() => void download('pdf')}>
          <Download aria-hidden className="size-4 text-foreground/62" />
          Export PDF
          <DropdownMenuShortcut>.pdf</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onFolder}>
          <FolderPlus aria-hidden className="size-4 text-foreground/62" />
          {folder}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The one folder picker, for either place's Save to folder. */
export function DraftFolderPicker({ draft, space }: { draft: DraftSave; space: ConversationSpaceRef | null }) {
  const { saved } = draft;
  if (!saved) return null;
  return (
    <FolderPicker
      target={{ type: 'note', contentId: saved.id }}
      title={folderLabel(space)}
      space={space ?? undefined}
      open={draft.folderOpen}
      onOpenChange={draft.setFolderOpen}
    />
  );
}
