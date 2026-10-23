'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { Check, Copy, Redo2, Undo2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useV2Session } from '@/v2/runtime/session-context';
import { AlignMenu } from '@/v2/features/notes/editor/AlignMenu';
import { FontMenu, SizeMenu } from '@/v2/features/notes/editor/FontMenus';
import { createNoteExtensions } from '@/v2/features/notes/editor/extensions';
import { runFormat, useFormatState } from '@/v2/features/notes/editor/formatting';
import { createCaseMentionStore } from '@/v2/features/notes/editor/mention-store';
import { stripPastedPresentation } from '@/v2/features/notes/editor/paste-sanitizer';
import { shortcutLabel, useIsMac } from '@/v2/features/notes/editor/shortcut-label';
import { StyleSelect } from '@/v2/features/notes/editor/StyleSelect';
import { ToolbarButton, ToolbarDivider } from '@/v2/features/notes/editor/ToolbarButton';
import { BLOCK_VERBS, REDO_KEYS, TEXT_VERBS, UNDO_KEYS } from '@/v2/features/notes/editor/toolbar-verbs';
import '@/v2/features/notes/note-fonts.css';
import type { ConversationSpaceRef } from '@/types/chat';
import { readDraftEdit, readSavedDraftNote, writeDraftEdit } from './draft-edits';
import { DraftSaveBar } from './DraftSaveBar';
import { markdownToDoc } from './markdown-to-doc';

/**
 * DraftEditor — a finished draft, editable in the side panel with the note
 * editor's own schema and controls (the draft editor, Stay 23 October 2026:
 * "Font size and type for now"). The same extensions as a note
 * (extensions.ts), so what is written here saves into a note unchanged; the
 * same paste cleaning; and a toolbar of the verbs a document needs: text
 * style, bold, italic, underline, both lists, alignment, and font type and
 * size (FontMenus.tsx).
 *
 * It opens from the reader's earlier edits if they made any this visit
 * (draft-edits.ts), else from the draft's Markdown (markdown-to-doc.ts). Every
 * change is kept there as it is typed. Save as note (DraftSaveBar.tsx) keeps
 * it for good, and offers the note's links once it is one.
 */
export function DraftEditor({
  conversationId,
  ordinal,
  title,
  markdown,
  space,
}: {
  conversationId: string;
  ordinal: number;
  title: string;
  markdown: string;
  /** The chat's Space, for Save to Space folder; `null` outside one. */
  space: ConversationSpaceRef | null;
}) {
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
    content: readDraftEdit(conversationId, ordinal) ?? markdownToDoc(markdown),
    onUpdate: ({ editor: instance }) => {
      writeDraftEdit(conversationId, ordinal, instance.getJSON());
      setDirty(true);
    },
    editorProps: {
      transformPastedHTML: stripPastedPresentation,
      attributes: {
        'aria-label': 'Draft',
        class: cn(
          'v2-note-fonts prose prose-neutral max-w-none dark:prose-invert',
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

  return (
    <div className="flex min-h-full flex-col">
      {editor ? <DraftToolbar editor={editor} /> : <div aria-hidden className="h-12 shrink-0 border-b border-border/70" />}
      <div className="mx-auto w-full max-w-[68ch] flex-1 px-5 py-6 xl:px-8">
        <EditorContent editor={editor} />
      </div>
      {editor ? (
        <DraftSaveBar
          editor={editor}
          conversationId={conversationId}
          ordinal={ordinal}
          title={title}
          dirty={dirty}
          onSaved={() => setDirty(false)}
          space={space}
        />
      ) : null}
    </div>
  );
}

const LIST_VERBS = BLOCK_VERBS.filter((verb) => verb.verb === 'bulletList' || verb.verb === 'orderedList');
const MARK_VERBS = TEXT_VERBS.filter((verb) => verb.verb === 'bold' || verb.verb === 'italic' || verb.verb === 'underline');

/**
 * The panel's one bar: it sticks to the panel's top while the draft scrolls.
 * It wraps onto more rows wherever it runs out of width, so every control is
 * in sight: beside the chat on a computer (the first pictures had lists,
 * alignment and Copy past the edge) and on a phone too, where a sideways row
 * hid size, bold and the rest with no sign they were there (Lucy's live check,
 * 23 October 2026).
 */
function DraftToolbar({ editor }: { editor: Editor }) {
  const state = useFormatState(editor);
  const [copied, setCopied] = useState(false);
  const mac = useIsMac();
  const keys = (binding: string) => shortcutLabel(binding, mac);

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      aria-orientation="horizontal"
      className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-x-0.5 gap-y-1 border-b border-border/70 bg-popover/95 px-3 py-1.5 backdrop-blur-sm xl:px-4"
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
      {/* The draft as it now reads, as plain text, for pasting elsewhere. */}
      <ToolbarButton
        compact
        icon={copied ? Check : Copy}
        label={copied ? 'Copied' : 'Copy text'}
        onPress={() => {
          void navigator.clipboard.writeText(editor.getText({ blockSeparator: '\n\n' })).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          });
        }}
      />
    </div>
  );
}
