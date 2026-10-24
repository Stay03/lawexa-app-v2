'use client';

import { useRef, useState, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Content } from '@tiptap/core';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { Check, Copy, MoreHorizontal, Redo2, Undo2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { useV2Session } from '@/v2/runtime/session-context';
import { AlignMenu } from '@/v2/features/notes/editor/AlignMenu';
import { FontMenu, FontSizeMenu, SizeMenu } from '@/v2/features/notes/editor/FontMenus';
import { createNoteExtensions } from '@/v2/features/notes/editor/extensions';
import { applyAlign, runFormat, useFormatState, type FormatState } from '@/v2/features/notes/editor/formatting';
import { createCaseMentionStore } from '@/v2/features/notes/editor/mention-store';
import { stripPastedPresentation } from '@/v2/features/notes/editor/paste-sanitizer';
import { shortcutLabel, useIsMac } from '@/v2/features/notes/editor/shortcut-label';
import { StyleSelect } from '@/v2/features/notes/editor/StyleSelect';
import { PILL_TRIGGER, ToolbarButton, ToolbarDivider, ToolbarDot } from '@/v2/features/notes/editor/ToolbarButton';
import {
  ALIGN_OPTIONS,
  BLOCK_VERBS,
  REDO_KEYS,
  TEXT_VERBS,
  UNDO_KEYS,
} from '@/v2/features/notes/editor/toolbar-verbs';
import '@/v2/features/notes/note-fonts.css';
import './draft-panel.css';
import type { ConversationSpaceRef } from '@/types/chat';
import { SidePanelActions } from '../side-panel/ChatSidePanel';
import { readDraftEdit, readSavedDraftNote, writeDraftEdit } from './draft-edits';
import { DraftFolderPicker, DraftSaveBar, DraftSaveControl, useDraftSave } from './DraftSaveBar';
import { markdownToDoc, type DraftFont } from './markdown-to-doc';
import { useDraftNote } from './use-draft-note';

/**
 * DraftEditor — a finished draft, editable in the side panel with the note
 * editor's own schema and controls (the draft editor, Stay 23 October 2026:
 * "Font size and type for now"). The same extensions as a note
 * (extensions.ts), so what is written here saves into a note unchanged; the
 * same paste cleaning; and a toolbar of the verbs a document needs: text
 * style, bold, italic, underline, both lists, alignment, and font type and
 * size (FontMenus.tsx).
 *
 * It opens from, in order: the reader's edits this visit (draft-edits.ts); the
 * note it was saved as, on any device (`useDraftNote`, Lucy's live check,
 * 23 October 2026: a reopened draft had lost its fonts); else the draft's
 * Markdown (markdown-to-doc.ts). Every change is kept as it is typed. Save as
 * note (DraftSaveBar.tsx) keeps it for good, and offers the note's links once
 * it is one.
 *
 * ── TWO SHAPES, ONE EDITOR ─────────────────────────────────────────────────
 * The phone sheet (below xl) has the wrapped toolbar on top and Save in the
 * foot. Beside the chat on a computer it is take B (Stay 24 October 2026): a
 * floating bar over the top of the document that stays put while the draft
 * scrolls, the document with no frame under it, and Save at the end of the
 * panel's slim title line (`SidePanelActions`). Both shapes are drawn and CSS
 * shows one, so a resize never remounts the editor or loses a save in flight.
 */
export function DraftEditor(props: DraftEditorProps) {
  const { conversationId, ordinal } = props;
  const edited = readDraftEdit(conversationId, ordinal);
  // The saved note is asked for only when this visit has no edits of its own.
  const note = useDraftNote(conversationId, ordinal, edited === undefined);

  if (edited !== undefined) return <DraftEditorBody {...props} initial={edited} />;
  if (note.isPending) return <DraftEditorSkeleton />;
  // A failed lookup opens the draft as Lawexa wrote it; a save then finds the
  // note on the server anyway (`useSaveDraftNote`), so none is made twice.
  const saved = note.data?.content;
  return <DraftEditorBody {...props} initial={saved ? saved : markdownToDoc(props.markdown, props.font)} />;
}

interface DraftEditorProps {
  conversationId: string;
  ordinal: number;
  title: string;
  markdown: string;
  /** The draft's own font and size from its tag, put on all its text. */
  font: DraftFont;
  /** The chat's Space, for Save to Space folder; `null` outside one. */
  space: ConversationSpaceRef | null;
}

/** The document's frame: a document measure, generous room on a computer, the top under the floating bar. */
const DOCUMENT = 'mx-auto w-full max-w-[68ch] px-5 py-6 xl:px-10 xl:pt-18 xl:pb-30 xl:text-[15px]';

/** The editor's frame while the saved note is looked up: the bar, then lines. */
function DraftEditorSkeleton() {
  return (
    <div aria-hidden className="flex min-h-full flex-col">
      <div className="h-12 shrink-0 border-b border-border/70 xl:hidden" />
      <div className={cn(DOCUMENT, 'flex flex-col gap-3')}>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}

function DraftEditorBody({
  conversationId,
  ordinal,
  title,
  space,
  initial,
}: DraftEditorProps & { initial: Content }) {
  // Changed since its last save, or never saved: what Save offers.
  const [dirty, setDirty] = useState(() => readSavedDraftNote(conversationId, ordinal) === undefined);
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();
  const [extensions] = useState(() =>
    createNoteExtensions({
      placeholder: 'Write your draft…',
      mentionStore: createCaseMentionStore({ queryClient, viewerId }),
    }),
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initial,
    onUpdate: ({ editor: instance }) => {
      writeDraftEdit(conversationId, ordinal, instance.getJSON());
      setDirty(true);
    },
    editorProps: {
      transformPastedHTML: stripPastedPresentation,
      attributes: {
        'aria-label': 'Draft',
        class: cn(
          'v2-note-fonts v2-draft-doc prose prose-neutral max-w-none dark:prose-invert',
          'min-h-[40vh] pb-10 text-base leading-relaxed focus:outline-none',
          'prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary',
          '[&_mark]:rounded-[0.2em] [&_mark]:bg-primary/28 [&_mark]:px-[0.1em] [&_mark]:text-inherit',
          '[&_code]:before:content-none [&_code]:after:content-none',
          '[&_.tableWrapper]:my-4 [&_.tableWrapper]:overflow-x-auto [&_.tableWrapper]:overscroll-x-contain',
          '[&_table]:my-0 [&_table]:w-full [&_table]:border-collapse',
          '[&_td]:min-w-[6em] [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top',
          '[&_th]:min-w-[6em] [&_th]:border [&_th]:border-border [&_th]:bg-secondary/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:align-top',
        ),
      },
    },
  });

  const draft = useDraftSave({ editor, conversationId, ordinal, title, onSaved: () => setDirty(false) });

  return (
    <div className="flex min-h-full flex-col">
      {editor ? (
        <>
          <DraftToolbar editor={editor} />
          <DraftPillToolbar editor={editor} />
        </>
      ) : (
        <div aria-hidden className="h-12 shrink-0 border-b border-border/70 xl:hidden" />
      )}
      <div className={cn(DOCUMENT, 'flex-1')}>
        <EditorContent editor={editor} />
      </div>
      {editor ? (
        <>
          <DraftSaveBar draft={draft} dirty={dirty} space={space} />
          <SidePanelActions>
            <DraftSaveControl draft={draft} dirty={dirty} space={space} />
          </SidePanelActions>
          <DraftFolderPicker draft={draft} space={space} />
        </>
      ) : null}
    </div>
  );
}

const LIST_VERBS = BLOCK_VERBS.filter((verb) => verb.verb === 'bulletList' || verb.verb === 'orderedList');
const MARK_VERBS = TEXT_VERBS.filter((verb) => verb.verb === 'bold' || verb.verb === 'italic' || verb.verb === 'underline');

/** Copy the draft as it now reads, as plain text, for pasting elsewhere; "Copied" for a moment after. */
function useCopyText(editor: Editor) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(editor.getText({ blockSeparator: '\n\n' })).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };
  return { copied, copy };
}

/**
 * The phone sheet's bar: it sticks to the panel's top while the draft scrolls.
 * It wraps onto more rows wherever it runs out of width, so every control is
 * in sight: on a phone a sideways row hid size, bold and the rest with no sign
 * they were there (Lucy's live check, 23 October 2026). Not drawn on a
 * computer, where the floating bar takes its place.
 */
function DraftToolbar({ editor }: { editor: Editor }) {
  const state = useFormatState(editor);
  const { copied, copy } = useCopyText(editor);
  const mac = useIsMac();
  const keys = (binding: string) => shortcutLabel(binding, mac);

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-orientation="horizontal"
      className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-x-0.5 gap-y-1 border-b border-border/70 bg-popover/95 px-3 py-1.5 backdrop-blur-sm xl:hidden"
    >
      <ToolbarButton
        compact
        icon={Undo2}
        label="Undo"
        shortcut={keys(UNDO_KEYS)}
        disabled={!state.canUndo}
        onPress={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        compact
        icon={Redo2}
        label="Redo"
        shortcut={keys(REDO_KEYS)}
        disabled={!state.canRedo}
        onPress={() => editor.chain().focus().redo().run()}
      />
      <ToolbarDivider />
      <StyleSelect editor={editor} state={state} mac={mac} />
      <FontMenu editor={editor} />
      <SizeMenu editor={editor} />
      <ToolbarDivider />
      {MARK_VERBS.map(({ verb, icon, label, keys: binding }) => (
        <ToolbarButton
          compact
          key={verb}
          icon={icon}
          label={label}
          shortcut={keys(binding)}
          active={state[verb]}
          disabled={state.inCodeBlock}
          onPress={() => runFormat(editor, verb)}
        />
      ))}
      <ToolbarDivider />
      {LIST_VERBS.map(({ verb, icon, label, keys: binding }) => (
        <ToolbarButton
          compact
          key={verb}
          icon={icon}
          label={label}
          shortcut={keys(binding)}
          active={state[verb]}
          onPress={() => runFormat(editor, verb)}
        />
      ))}
      <AlignMenu editor={editor} state={state} mac={mac} />
      <ToolbarDivider />
      <ToolbarButton compact icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy text'} onPress={copy} />
    </div>
  );
}

/**
 * Below this width of the panel (px), the floating bar folds Redo and
 * Underline into its ··· menu, as the mock does at a 1280 screen. The bar
 * hides them in CSS with the same number (`@max-[32.5rem]/draft`); the menu,
 * drawn in a portal outside that container, measures the panel when it opens.
 */
const PILL_FOLD_WIDTH = 520;

const UNDERLINE = TEXT_VERBS.find((verb) => verb.verb === 'underline');

/**
 * The computer's floating bar (take B, Stay 24 October 2026): one pill over
 * the top of the document, sticky while the draft scrolls under it.
 *
 *   undo · redo  •  Normal · Times New Roman 14  •  B I U · ···
 *
 * ··· holds both lists, alignment and Copy text, and Redo and Underline when
 * the panel is narrow. No outlined boxes and no border on the pill: soft
 * fills on hover (ToolbarButton `pill`) and a soft shadow (draft-panel.css).
 */
function DraftPillToolbar({ editor }: { editor: Editor }) {
  const state = useFormatState(editor);
  const mac = useIsMac();
  const keys = (binding: string) => shortcutLabel(binding, mac);
  const frameRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={frameRef} className="@container/draft sticky top-0 z-10 hidden h-0 xl:block">
      <div className="pointer-events-none flex justify-center px-3 pt-1.5">
        <div
          role="toolbar"
          aria-label="Formatting"
          aria-orientation="horizontal"
          className="v2-draft-pill pointer-events-auto flex h-10.5 items-center gap-px rounded-[14px] px-1.5"
        >
          <ToolbarButton
            pill
            icon={Undo2}
            label="Undo"
            shortcut={keys(UNDO_KEYS)}
            disabled={!state.canUndo}
            onPress={() => editor.chain().focus().undo().run()}
          />
          <span className="contents @max-[32.5rem]/draft:hidden">
            <ToolbarButton
              pill
              icon={Redo2}
              label="Redo"
              shortcut={keys(REDO_KEYS)}
              disabled={!state.canRedo}
              onPress={() => editor.chain().focus().redo().run()}
            />
          </span>
          <ToolbarDot />
          <StyleSelect editor={editor} state={state} mac={mac} pill menuClassName="v2-draft-menu" />
          <FontSizeMenu editor={editor} menuClassName="v2-draft-menu" />
          <ToolbarDot />
          {MARK_VERBS.map(({ verb, icon, label, keys: binding }) => (
            <span key={verb} className={cn('contents', verb === 'underline' && '@max-[32.5rem]/draft:hidden')}>
              <ToolbarButton
                pill
                icon={icon}
                label={label}
                shortcut={keys(binding)}
                active={state[verb]}
                disabled={state.inCodeBlock}
                onPress={() => runFormat(editor, verb)}
              />
            </span>
          ))}
          <PillMoreMenu editor={editor} state={state} mac={mac} frameRef={frameRef} />
        </div>
      </div>
    </div>
  );
}

/** The floating bar's ···: lists, alignment and Copy text; Redo and Underline too on a narrow panel. */
function PillMoreMenu({
  editor,
  state,
  mac,
  frameRef,
}: {
  editor: Editor;
  state: FormatState;
  mac: boolean;
  frameRef: RefObject<HTMLDivElement | null>;
}) {
  const [folded, setFolded] = useState(false);
  const { copied, copy } = useCopyText(editor);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) setFolded((frameRef.current?.clientWidth ?? PILL_FOLD_WIDTH) < PILL_FOLD_WIDTH);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label="More formatting"
            onMouseDown={(event) => event.preventDefault()}
            className={cn(PILL_TRIGGER, 'size-7.5', FOCUS_RING)}
          >
            <MoreHorizontal aria-hidden className="size-[17px]" />
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          More
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="v2-draft-menu w-56"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.commands.focus();
        }}
      >
        {folded ? (
          <>
            <DropdownMenuItem disabled={!state.canRedo} onSelect={() => editor.chain().focus().redo().run()}>
              <Redo2 aria-hidden className="size-4" />
              Redo
              <DropdownMenuShortcut>{shortcutLabel(REDO_KEYS, mac)}</DropdownMenuShortcut>
            </DropdownMenuItem>
            {UNDERLINE ? (
              <DropdownMenuCheckboxItem
                checked={state.underline}
                disabled={state.inCodeBlock}
                onSelect={() => runFormat(editor, UNDERLINE.verb)}
              >
                <UNDERLINE.icon aria-hidden className="size-4" />
                {UNDERLINE.label}
                <DropdownMenuShortcut>{shortcutLabel(UNDERLINE.keys, mac)}</DropdownMenuShortcut>
              </DropdownMenuCheckboxItem>
            ) : null}
            <DropdownMenuSeparator />
          </>
        ) : null}
        {LIST_VERBS.map(({ verb, icon: Icon, label, keys: binding }) => (
          <DropdownMenuCheckboxItem key={verb} checked={state[verb]} onSelect={() => runFormat(editor, verb)}>
            <Icon aria-hidden className="size-4" />
            {label}
            <DropdownMenuShortcut>{shortcutLabel(binding, mac)}</DropdownMenuShortcut>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={state.align}>
          {ALIGN_OPTIONS.map(({ align, icon: Icon, label, keys: binding }) => (
            <DropdownMenuRadioItem
              key={align}
              value={align}
              disabled={state.inCodeBlock}
              onSelect={() => applyAlign(editor, align)}
            >
              <Icon aria-hidden className="size-4" />
              {label}
              <DropdownMenuShortcut>{shortcutLabel(binding, mac)}</DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {/* The menu stays open after a copy, so "Copied" is seen. */}
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            copy();
          }}
        >
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied ? 'Copied' : 'Copy text'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
