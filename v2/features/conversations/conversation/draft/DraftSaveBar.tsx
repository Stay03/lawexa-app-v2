'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Editor } from '@tiptap/react';
import { ArrowUpRight, ChevronDown, Download, FolderPlus, History, Loader2, MoreHorizontal } from 'lucide-react';

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
import { SaveIndicator } from '@/v2/features/notes/editor/SaveIndicator';
import type { AutosaveView } from '@/v2/features/notes/editor/use-autosave';
import { useNoteExport } from '@/v2/features/notes/use-note-export';
import { useDraftDownload, type DraftDownload } from './use-draft-download';

/**
 * The right of the draft panel's bar on a computer, and the phone sheet's
 * foot: what the panel says about saving, and what the reader can do with the
 * draft (drafts saved as notes, thread 1e44eb39).
 *
 * Every draft is a note now, and its newest version autosaves into it as the
 * reader types, so there is no Save button. In its place the note editor's
 * own `SaveIndicator`: silent while all is saved, "Saving", a short "Saved",
 * and a chip with Retry when a save fails. Then the note's ··· menu: Open
 * note, Export Word and PDF (the server renders the saved note, fonts and
 * all), Version history, and Save to folder.
 *
 * Where nothing is saved (an older version, a confidential chat, a note the
 * reader deleted, a note not reached), the draft downloads as it stands, with
 * no note made: a Download menu on a computer, Word and PDF pills on a phone
 * (Stay, 24 and 25 October 2026).
 */

/** The panel's downloads and the folder picker's open state, for either place. */
export function useDraftTools(editor: Editor | null, title: string) {
  const [folderOpen, setFolderOpen] = useState(false);
  const downloads = useDraftDownload(editor, title);
  return { downloads, folderOpen, setFolderOpen };
}

export type DraftTools = ReturnType<typeof useDraftTools>;

/**
 * The draft panel's menus: its own surface (draft-panel.css), as wide as the
 * longest row so no row wraps, and never wider than the screen.
 */
export const DRAFT_MENU = 'v2-draft-menu w-max min-w-56 max-w-[calc(100vw-1rem)]';

/** The note a draft is, where there is one. */
export interface DraftNoteRef {
  id: number;
  slug: string;
}

interface DraftActionsProps {
  tools: DraftTools;
  /** The draft's note, or `null` where nothing is saved. */
  note: DraftNoteRef | null;
  /** The note's autosave, while the reader edits it; `null` when nothing saves from here. */
  autosave: (Pick<AutosaveView, 'status' | 'savedAt' | 'failure' | 'retryScheduled'> & { onRetry: () => void }) | null;
  space: ConversationSpaceRef | null;
  /** Opens the note's version history. */
  onHistory: () => void;
}

function folderLabel(space: ConversationSpaceRef | null): string {
  return space ? 'Save to Space folder' : 'Save to folder';
}

/** A failed download, in a small box under the computer's menu. */
const FAILURE_BOX = 'v2-draft-surface rounded-lg px-3 py-2 text-xs leading-snug text-destructive';

/** The right of the computer's bar: the save state, then the note's menu or the downloads. Inside `@container/draft`. */
export function DraftSaveControl({ tools, note, autosave, space, onHistory }: DraftActionsProps) {
  return (
    <div className="relative hidden shrink-0 items-center gap-1 xl:flex">
      {autosave ? <SaveIndicator {...autosave} /> : null}
      {note ? (
        <NoteMenu
          note={note}
          saving={autosave !== null}
          folder={folderLabel(space)}
          onFolder={() => tools.setFolderOpen(true)}
          onHistory={onHistory}
        />
      ) : (
        <DownloadMenu downloads={tools.downloads} />
      )}
      {tools.downloads.failure ? (
        <div className="absolute top-full right-0 z-30 mt-1.5 w-64">
          <p role="alert" className={FAILURE_BOX}>
            {tools.downloads.failure}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** The phone sheet's foot. Not drawn on a computer, where the bar holds the same. */
export function DraftSaveBar({ tools, note, autosave, space, onHistory }: DraftActionsProps) {
  return (
    <div className="v2-draft-save-foot sticky bottom-0 z-10 border-t border-border/70 bg-popover px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {autosave ? <SaveIndicator {...autosave} /> : <span />}
        {note ? (
          <NoteMenu
            note={note}
            saving={autosave !== null}
            folder={folderLabel(space)}
            onFolder={() => tools.setFolderOpen(true)}
            onHistory={onHistory}
            triggerClassName="size-10"
          />
        ) : (
          // Short words so the row stays one row on a phone; the full name is the button's.
          <div className="flex items-center gap-2">
            <DownloadPill downloads={tools.downloads} format="docx" label="Download Word" short="Word" />
            <DownloadPill downloads={tools.downloads} format="pdf" label="Download PDF" short="PDF" />
          </div>
        )}
      </div>
      {tools.downloads.failure ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {tools.downloads.failure}
        </p>
      ) : null}
    </div>
  );
}

/** A phone download where there is no note; the pressed one spins while it runs. */
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

/**
 * The note's menu: Open note, the two exports, Version history, then Save to
 * folder. The computer bar's 30px button; the phone sheet's foot passes a 40px one.
 */
function NoteMenu({
  note,
  saving,
  folder,
  onFolder,
  onHistory,
  triggerClassName = 'size-7.5',
}: {
  note: DraftNoteRef;
  /** The reader's edits save into it from here. */
  saving: boolean;
  folder: string;
  onFolder: () => void;
  onHistory: () => void;
  triggerClassName?: string;
}) {
  const { download, exporting } = useNoteExport(note.slug);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger aria-label="Draft note" className={cn(PILL_TRIGGER, triggerClassName, FOCUS_RING)}>
            {exporting ? (
              <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
            ) : (
              <MoreHorizontal aria-hidden className="size-[17px]" />
            )}
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Draft note
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className={DRAFT_MENU}>
        <DropdownMenuLabel className="px-2.5 pt-2 pb-1.5 text-[11.5px]">
          <span className="mb-px block text-[12.5px] font-semibold text-foreground">In your notes</span>
          {saving ? 'Your edits save as you type, and Lawexa sees them.' : 'Lawexa’s versions and your edits are kept.'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/notes/${note.slug}`}>
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
        <DropdownMenuItem onSelect={onHistory}>
          <History aria-hidden className="size-4 text-foreground/62" />
          Version history
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
export function DraftFolderPicker({
  tools,
  note,
  space,
}: {
  tools: DraftTools;
  note: DraftNoteRef | null;
  space: ConversationSpaceRef | null;
}) {
  if (!note) return null;
  return (
    <FolderPicker
      target={{ type: 'note', contentId: note.id }}
      title={folderLabel(space)}
      space={space ?? undefined}
      open={tools.folderOpen}
      onOpenChange={tools.setFolderOpen}
    />
  );
}

/**
 * The computer's downloads where there is no note: the draft as Word or PDF,
 * made from the panel as it stands. It spins while a download runs.
 */
function DownloadMenu({ downloads }: { downloads: DraftDownload }) {
  const { download, downloading } = downloads;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label="Download"
            className={cn(PILL_TRIGGER, 'h-7.5 gap-1 px-2 text-[13px] font-medium', FOCUS_RING)}
          >
            {downloading ? (
              <Loader2 aria-hidden className="size-[15px] motion-safe:animate-spin" />
            ) : (
              <Download aria-hidden className="size-[15px]" />
            )}
            <ChevronDown aria-hidden className="size-3.5 opacity-70" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Download
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className={DRAFT_MENU}>
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
