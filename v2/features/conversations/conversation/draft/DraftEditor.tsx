'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
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
import {
  applyAlign,
  applyStyle,
  runFormat,
  useFormatState,
  type FormatState,
} from '@/v2/features/notes/editor/formatting';
import { createCaseMentionStore } from '@/v2/features/notes/editor/mention-store';
import { stripPastedPresentation } from '@/v2/features/notes/editor/paste-sanitizer';
import { shortcutLabel, useIsMac } from '@/v2/features/notes/editor/shortcut-label';
import { StyleSelect } from '@/v2/features/notes/editor/StyleSelect';
import { PILL_TRIGGER, ToolbarButton, ToolbarDivider, ToolbarDot } from '@/v2/features/notes/editor/ToolbarButton';
import {
  ALIGN_OPTIONS,
  BLOCK_VERBS,
  REDO_KEYS,
  STYLE_OPTIONS,
  TEXT_VERBS,
  UNDO_KEYS,
} from '@/v2/features/notes/editor/toolbar-verbs';
import '@/v2/features/notes/note-fonts.css';
import './draft-panel.css';
import type { ConversationSpaceRef } from '@/types/chat';
import { SidePanelCloseButton } from '../side-panel/ChatSidePanel';
import { readDraftEdit, readSavedDraftNote, writeDraftEdit } from './draft-edits';
import { DRAFT_MENU, DraftFolderPicker, DraftSaveBar, DraftSaveControl, useDraftSave } from './DraftSaveBar';
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
 * foot. Beside the chat on a computer it is take B2 (Stay 24 October 2026):
 * the panel has no header, and one bar across its top (`DraftBar`) holds the
 * formatting on the left and Save and the close on the right; under it the
 * document spans the panel's width with even margins, up to a reading width.
 * Both shapes are drawn and CSS shows one, so a resize never remounts the
 * editor or loses a save in flight.
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

/**
 * How far from the scroller's edges the caret is kept when it is scrolled to
 * (px): clear of the sticky toolbar above (two rows on the phone sheet) and
 * of Save at the foot.
 */
const CARET_MARGIN_TOP = 112;
const CARET_MARGIN_BOTTOM = 96;

/**
 * The document's frame. On the phone sheet a document measure. On a computer
 * the panel's width with even margins, 48px, or 32px on a panel under 37.5rem
 * (a 1280 screen), up to a 780px reading width (Stay, 24 October 2026: "waste
 * of horizontal space"). Inside an `@container/draft`.
 */
export const DRAFT_DOCUMENT =
  'mx-auto w-full max-w-[68ch] px-5 py-6 xl:max-w-[876px] xl:px-8 xl:pt-8 xl:pb-30 xl:text-[15px] xl:@min-[37.5rem]/draft:px-12';

/**
 * The panel's one bar on a computer: a filled band across the top, with no
 * stroke, no shadow and no corners, that stays while the draft scrolls. The
 * formatting on the left, then Save, then the close. A draft still being
 * written, or one no longer in the chat, shows the bar with the close alone.
 * Not drawn below xl, where the sheet has its header and its own toolbar.
 */
export function DraftBar({ tools, actions }: { tools?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="v2-draft-bar sticky top-0 z-10 hidden h-12 shrink-0 items-center gap-2 pr-2.5 pl-2 xl:flex">
      <div className="flex min-w-0 flex-1 items-center">{tools}</div>
      {actions}
      <SidePanelCloseButton />
    </div>
  );
}

/** The editor's frame while the saved note is looked up: the bar, then lines. */
function DraftEditorSkeleton() {
  return (
    <div className="@container/draft flex min-h-full flex-col">
      <div aria-hidden className="h-12 shrink-0 border-b border-border/70 xl:hidden" />
      <DraftBar />
      <div aria-hidden className={cn(DRAFT_DOCUMENT, 'flex flex-col gap-3')}>
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
  const frameRef = useRef<HTMLDivElement | null>(null);
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
      // The caret is kept clear of the sticky toolbar at the top and Save at the foot when it is scrolled to.
      scrollThreshold: { top: CARET_MARGIN_TOP, bottom: CARET_MARGIN_BOTTOM, left: 0, right: 0 },
      scrollMargin: { top: CARET_MARGIN_TOP, bottom: CARET_MARGIN_BOTTOM, left: 0, right: 0 },
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

  // THE CARET STAYS IN VIEW AS THE KEYBOARD RISES (Arthur's iPhone, 24 October
  // 2026: "the tap on the specific portion of the note still takes the
  // blinker God knows where"). A tap puts the caret where it lands, then the
  // keyboard rises and the sheet, which takes the visible area, gets shorter
  // from the bottom, so a caret placed low in the draft ends up under the
  // keyboard's top edge, out of sight. Once the editor has focus, and on
  // every change of the visible area while it has it, the selection is
  // scrolled back into view, clear of the toolbar and Save.
  useEffect(() => {
    if (!editor) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const keepCaretInView = (): void => {
      if (!editor.isFocused) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!editor.isDestroyed) editor.commands.scrollIntoView();
      });
    };
    viewport?.addEventListener('resize', keepCaretInView);
    editor.on('focus', keepCaretInView);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', keepCaretInView);
      editor.off('focus', keepCaretInView);
    };
  }, [editor]);

  return (
    <div ref={frameRef} className="@container/draft flex min-h-full flex-col">
      {editor ? (
        <>
          <DraftToolbar editor={editor} />
          {/* While the reader types on a phone (draft-panel.css): the computer bar's
              tools, folded to one row (undo, font, B I, ··· with the rest), in place
              of the three-row toolbar above, so the draft keeps its lines. */}
          <div className="v2-draft-typing-tools sticky top-0 z-10 hidden h-11 shrink-0 items-center border-b border-border/70 bg-popover/95 px-2 backdrop-blur-sm">
            <DraftBarTools editor={editor} frameRef={frameRef} />
          </div>
          <DraftBar
            tools={<DraftBarTools editor={editor} frameRef={frameRef} />}
            actions={<DraftSaveControl draft={draft} dirty={dirty} space={space} />}
          />
        </>
      ) : (
        <>
          <div aria-hidden className="h-12 shrink-0 border-b border-border/70 xl:hidden" />
          <DraftBar />
        </>
      )}
      <div className={cn(DRAFT_DOCUMENT, 'flex-1')}>
        <EditorContent editor={editor} />
      </div>
      {editor ? (
        <>
          <DraftSaveBar draft={draft} dirty={dirty} space={space} />
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
 * computer, where the panel's one bar (`DraftBar`) takes its place.
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
      className="v2-draft-sheet-tools sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-x-0.5 gap-y-1 border-b border-border/70 bg-popover/95 px-3 py-1.5 backdrop-blur-sm xl:hidden"
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
 * Below this width of the panel (px), the bar folds Redo, Underline and the
 * text style into its ··· menu, so Save and the close still fit beside the
 * formatting at a 1280 screen. The bar hides them in CSS with the same number
 * (`@max-[37.5rem]/draft`); the menu, drawn in a portal outside that container,
 * measures the panel when it opens.
 */
const BAR_FOLD_WIDTH = 600;

const UNDERLINE = TEXT_VERBS.find((verb) => verb.verb === 'underline');

/**
 * The formatting on the left of the computer's bar (take B2, Stay 24 October
 * 2026):
 *
 *   undo · redo  •  Normal · Times New Roman 14  •  B I U · ···
 *
 * ··· holds both lists, alignment and Copy text, and Redo, Underline and the
 * text style when the panel is narrow. Soft fills on hover (ToolbarButton
 * `pill`), no outlined boxes.
 */
function DraftBarTools({ editor, frameRef }: { editor: Editor; frameRef: RefObject<HTMLDivElement | null> }) {
  const state = useFormatState(editor);
  const mac = useIsMac();
  const keys = (binding: string) => shortcutLabel(binding, mac);

  return (
    <div role="toolbar" aria-label="Formatting" aria-orientation="horizontal" className="flex min-w-0 items-center gap-px">
      <ToolbarButton
        pill
        icon={Undo2}
        label="Undo"
        shortcut={keys(UNDO_KEYS)}
        disabled={!state.canUndo}
        onPress={() => editor.chain().focus().undo().run()}
      />
      <span className="contents @max-[37.5rem]/draft:hidden">
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
      <span className="contents @max-[37.5rem]/draft:hidden">
        <StyleSelect editor={editor} state={state} mac={mac} pill menuClassName={DRAFT_MENU} />
      </span>
      <FontSizeMenu editor={editor} menuClassName={DRAFT_MENU} />
      <ToolbarDot />
      {MARK_VERBS.map(({ verb, icon, label, keys: binding }) => (
        <span key={verb} className={cn('contents', verb === 'underline' && '@max-[37.5rem]/draft:hidden')}>
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
      <BarMoreMenu editor={editor} state={state} mac={mac} frameRef={frameRef} />
    </div>
  );
}

/** The bar's ···: lists, alignment and Copy text; Redo, Underline and the text style too on a narrow panel. */
function BarMoreMenu({
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
        if (open) setFolded((frameRef.current?.clientWidth ?? BAR_FOLD_WIDTH) < BAR_FOLD_WIDTH);
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
        align="start"
        className={DRAFT_MENU}
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
            <DropdownMenuRadioGroup value={state.blockStyle}>
              {STYLE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem
                  key={option.style}
                  value={option.style}
                  disabled={state.inCodeBlock}
                  onSelect={() => applyStyle(editor, option.style)}
                >
                  {option.label}
                  <DropdownMenuShortcut>{shortcutLabel(option.keys, mac)}</DropdownMenuShortcut>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
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
