'use client';

import { useCallback, useEffect, useImperativeHandle, forwardRef, memo } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { cn } from '@/lib/utils';
import { EditorToolbar } from './EditorToolbar';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { CaseMention } from './mention';

export interface NoteEditorRef {
  getEditor: () => Editor | null;
}

interface NoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  onImageUpload?: (file: File) => Promise<string>;
  showToolbar?: boolean;
  onEditorReady?: (editor: Editor) => void;
  /** Force light mode styling (for MS Word-style white paper effect) */
  forceLight?: boolean;
}

/**
 * Clean, minimal rich text editor for notes using TipTap
 * Memoized to prevent unnecessary re-renders from parent components
 */
const NoteEditor = memo(forwardRef<NoteEditorRef, NoteEditorProps>(function NoteEditor(
  {
    content,
    onChange,
    placeholder = 'Note it down',
    className,
    onImageUpload,
    showToolbar = true,
    onEditorReady,
    forceLight = false,
  },
  ref
) {
  const editor = useEditor({
    immediatelyRender: false, // Prevent SSR hydration mismatch
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: forceLight ? 'text-blue-600 underline underline-offset-2' : 'text-primary underline underline-offset-2',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      CaseMention,
    ],
    content,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-lg max-w-none',
          !forceLight && 'dark:prose-invert',
          forceLight && 'text-neutral-800',
          'min-h-[400px] w-full',
          'py-4',
          'focus:outline-none',
          '[&_p]:my-4 [&_p]:leading-relaxed',
          '[&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-semibold',
          '[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold',
          '[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-xl [&_h3]:font-medium',
          forceLight && '[&_h1]:text-neutral-900 [&_h2]:text-neutral-900 [&_h3]:text-neutral-900',
          '[&_ul]:my-4 [&_ol]:my-4 [&_li]:my-2',
          forceLight
            ? '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-neutral-600'
            : '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:italic',
          forceLight
            ? '[&_code]:bg-neutral-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:text-neutral-700'
            : '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm',
          forceLight
            ? '[&_pre]:bg-neutral-100 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto'
            : '[&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto',
          forceLight && '[&_.is-editor-empty:first-child::before]:text-neutral-400',
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Expose editor instance via ref
  useImperativeHandle(ref, () => ({
    getEditor: () => editor,
  }), [editor]);

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Handle image upload from toolbar
  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!onImageUpload || !editor) return;

      try {
        const url = await onImageUpload(file);
        editor.chain().focus().setImage({ src: url }).run();
      } catch (error) {
        console.error('Failed to upload image:', error);
      }
    },
    [editor, onImageUpload]
  );

  if (!editor) {
    return (
      <div className={cn('bg-transparent', className)}>
        {showToolbar && (
          <div className="flex justify-center py-3 border-b border-border/50">
            <div className="h-8 w-64 bg-muted/50 rounded animate-pulse" />
          </div>
        )}
        <div className="min-h-[400px] animate-pulse" />
      </div>
    );
  }

  return (
    <div className={cn('bg-transparent', className)}>
      {showToolbar && (
        <EditorToolbar
          editor={editor}
          onImageUpload={onImageUpload ? handleImageUpload : undefined}
        />
      )}
      <EditorBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}));

export { NoteEditor };
