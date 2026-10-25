'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Editor } from '@tiptap/react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  NotebookPen,
} from 'lucide-react';

import type { DocumentExportFormat } from '@/lib/api/export';
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
import { PILL_TRIGGER } from '@/v2/features/notes/editor/ToolbarButton';
import { useNoteExport } from '@/v2/features/notes/use-note-export';
import { readSavedDraftNote } from './draft-edits';
import { saveFailureSentence } from './draft-save-failure';
import { useDraftDownload, type DraftDownload } from './use-draft-download';
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
 * Before the first save the draft downloads as it stands, with no note made
 * (Stay, 24 October 2026: "That save as note should be a drop-down of 'save
 * note, download docx, download pdf'"): on a computer the gold button is split,
 * its chevron a menu of Save as note, Download Word and Download PDF; on the
 * phone sheet the foot shows the two downloads beside Save as note.
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
  const downloads = useDraftDownload(editor, title);

  const press = () => {
    if (!editor || mutation.isPending) return;
    mutation.mutate({ title, html: editor.getHTML() }, { onSuccess: onSaved });
  };

  return { mutation, saved, press, folderOpen, setFolderOpen, downloads };
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

/**
 * The gold button's word: "Save" before the first save (Stay, 25 October
 * 2026: "just have 'Save'"), "Save changes" after an edit, "Saving…" while it
 * runs. A screen reader also hears what the first Save makes ({@link SaveAsNoteHint}).
 */
function saveLabel(draft: DraftSave): string {
  if (draft.mutation.isPending) return 'Saving…';
  return draft.saved ? 'Save changes' : 'Save';
}

/** " as a note", for a screen reader only, after the first Save's word. */
function SaveAsNoteHint({ draft }: { draft: DraftSave }) {
  return draft.saved || draft.mutation.isPending ? null : <span className="sr-only"> as a note</span>;
}

/** The bar's word on a panel under 37.5rem, where the formatting needs the room. */
function shortSaveLabel(draft: DraftSave): string {
  return draft.mutation.isPending ? 'Saving…' : 'Save';
}

/** The phone sheet's foot. Not drawn on a computer, where the title line holds Save. */
export function DraftSaveBar({ draft, dirty, space }: DraftSaveProps) {
  const { saved, mutation } = draft;
  return (
    <div className="v2-draft-save-foot sticky bottom-0 z-10 border-t border-border/70 bg-popover px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:hidden">
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
            <span aria-live="polite">
              {saveLabel(draft)}
              <SaveAsNoteHint draft={draft} />
            </span>
          </button>
        )}
        {/* Once saved, one row: the line and the saved note's ··· menu (Open note,
            Export Word, Export PDF, Save to folder), as on a computer (Arthur's
            iPhone recording, 24 October 2026: four pills wrapped onto two rows). */}
        {saved ? (
          <SavedNoteMenu
            slug={saved.slug}
            dirty={dirty}
            folder={folderLabel(space)}
            onFolder={() => draft.setFolderOpen(true)}
            triggerClassName="size-10"
          />
        ) : (
          // Before the first save, the draft downloads as it is, with no note
          // (Stay, 24 October 2026). Short words so the row stays one row
          // beside Save as note on a phone; the full name is the button's.
          <>
            <DownloadPill downloads={draft.downloads} format="docx" label="Download Word" short="Word" />
            <DownloadPill downloads={draft.downloads} format="pdf" label="Download PDF" short="PDF" />
          </>
        )}
      </div>
      {mutation.isError ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {saveFailureSentence(mutation.error)}
        </p>
      ) : null}
      {draft.downloads.failure ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {draft.downloads.failure}
        </p>
      ) : null}
    </div>
  );
}

/** A phone download before the first save; the pressed one spins while it runs. */
function DownloadPill({
  downloads,
  format,
  label,
  short,
}: {
  downloads: DraftDownload;
  format: DocumentExportFormat;
  /** The button's name: "Download Word". */
  label: string;
  /** The word it shows beside the download mark: "Word". */
  short: string;
}) {
  return (
    <button
      type="button"
      onClick={() => void downloads.download(format)}
      aria-disabled={downloads.downloading !== null}
      aria-label={label}
      className={cn(ACTION_PILL, FOCUS_RING)}
    >
      {downloads.downloading === format ? (
        <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
      ) : (
        <Download aria-hidden className="size-4" />
      )}
      {short}
    </button>
  );
}

/** The gold of Save as note and its chevron: one fill, one raised edge. */
const GOLD_FACE =
  'shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(0_0_0/0.15)] transition-colors hover:bg-primary/90';

/** A failed save or download, in a small box under the computer's button. */
const FAILURE_BOX = 'v2-draft-surface rounded-lg px-3 py-2 text-xs leading-snug text-destructive';

/**
 * The right of the computer's bar: the gold Save as note (or Save changes),
 * or once saved the quiet chip, then the ··· menu once there is a note.
 * Before the first save the gold button is split: a 1px space (no line, by
 * Stay's no-outlines rule), then a chevron whose menu also downloads the
 * draft as Word or PDF. A failed save or download says why in a small box
 * under the button. Inside the panel's `@container/draft`.
 */
export function DraftSaveControl({ draft, dirty, space }: DraftSaveProps) {
  const { saved, mutation, downloads } = draft;
  return (
    <div className={cn('relative hidden shrink-0 items-center xl:flex', saved ? 'gap-0.5' : 'gap-px')}>
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
            'v2-interactive inline-flex h-8 items-center gap-1.75 bg-primary pr-3.25 pl-2.75 text-[13px] font-semibold whitespace-nowrap text-primary-foreground',
            saved ? 'rounded-[9px]' : 'rounded-l-[9px]',
            GOLD_FACE,
            FOCUS_RING,
          )}
        >
          {mutation.isPending ? (
            <Loader2 aria-hidden className="size-[15px] motion-safe:animate-spin" />
          ) : (
            <NotebookPen aria-hidden className="size-[15px]" />
          )}
          <span aria-live="polite">
            <span className="@max-[37.5rem]/draft:hidden">
              {saveLabel(draft)}
              <SaveAsNoteHint draft={draft} />
            </span>
            <span className="hidden @max-[37.5rem]/draft:inline">
              {shortSaveLabel(draft)}
              <SaveAsNoteHint draft={draft} />
            </span>
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
      ) : (
        <SaveMoreMenu draft={draft} />
      )}
      {mutation.isError || downloads.failure ? (
        <div className="absolute top-full right-0 z-30 mt-1.5 flex w-64 flex-col gap-1">
          {mutation.isError ? (
            <p role="alert" className={FAILURE_BOX}>
              {saveFailureSentence(mutation.error)}
            </p>
          ) : null}
          {downloads.failure ? (
            <p role="alert" className={FAILURE_BOX}>
              {downloads.failure}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The saved note's menu: Open note, the two exports, then Save to folder. The
 * computer bar's 30px button; the phone sheet's foot passes a 40px one.
 */
function SavedNoteMenu({
  slug,
  dirty,
  folder,
  onFolder,
  triggerClassName = 'size-7.5',
}: {
  slug: string;
  dirty: boolean;
  folder: string;
  onFolder: () => void;
  triggerClassName?: string;
}) {
  const { download, exporting } = useNoteExport(slug);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger aria-label="Saved note" className={cn(PILL_TRIGGER, triggerClassName, FOCUS_RING)}>
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

/**
 * The gold chevron beside Save as note before the first save: Save as note
 * again, then the draft as Word or PDF, made from the editor as it stands and
 * with no note made. It spins while a download runs.
 */
function SaveMoreMenu({ draft }: { draft: DraftSave }) {
  const { download, downloading } = draft.downloads;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label="More ways to save"
            className={cn(
              'v2-interactive inline-flex h-8 w-7 items-center justify-center rounded-r-[9px] bg-primary text-primary-foreground',
              GOLD_FACE,
              FOCUS_RING,
            )}
          >
            {downloading ? (
              <Loader2 aria-hidden className="size-[15px] motion-safe:animate-spin" />
            ) : (
              <ChevronDown aria-hidden className="size-[15px]" />
            )}
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          More ways to save
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className={DRAFT_MENU}>
        <DropdownMenuItem disabled={draft.mutation.isPending} onSelect={draft.press}>
          <NotebookPen aria-hidden className="size-4 text-foreground/62" />
          Save
          <span className="sr-only"> as a note</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={downloading !== null} onSelect={() => void download('docx')}>
          <Download aria-hidden className="size-4 text-foreground/62" />
          Download Word
          <DropdownMenuShortcut>.docx</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={downloading !== null} onSelect={() => void download('pdf')}>
          <Download aria-hidden className="size-4 text-foreground/62" />
          Download PDF
          <DropdownMenuShortcut>.pdf</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
