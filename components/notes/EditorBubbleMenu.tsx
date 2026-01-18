'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link as LinkIcon,
  Heading2,
  Quote,
  Code,
  Copy,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EditorBubbleMenuProps {
  editor: Editor;
}

interface BubbleButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}

function BubbleButton({
  onClick,
  isActive = false,
  disabled = false,
  children,
  title,
}: BubbleButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-7 w-7 rounded-sm text-white/90 hover:text-white hover:bg-white/10',
        isActive && 'bg-white/20 text-white'
      )}
    >
      {children}
    </Button>
  );
}

/**
 * Floating bubble menu that appears when text is selected
 */
function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [, forceUpdate] = useState({});

  // Register the bubble menu plugin
  useEffect(() => {
    if (!menuRef.current || !editor) return;

    const plugin = BubbleMenuPlugin({
      pluginKey: 'bubbleMenu',
      editor,
      element: menuRef.current,
      updateDelay: 100,
      shouldShow: ({ editor: e, state }) => {
        // Don't show for empty selection
        const { from, to } = state.selection;
        const isEmpty = from === to;

        // Don't show if we're in a code block
        const isCodeBlock = e.isActive('codeBlock');

        return !isEmpty && !isCodeBlock;
      },
      options: {
        placement: 'top',
        offset: { mainAxis: 8, crossAxis: 0 },
      },
    });

    editor.registerPlugin(plugin);

    // Force re-render when selection changes to update active states
    // Note: Only listen to selectionUpdate, not transaction (which fires on every keystroke)
    const updateHandler = () => forceUpdate({});
    editor.on('selectionUpdate', updateHandler);

    return () => {
      editor.unregisterPlugin('bubbleMenu');
      editor.off('selectionUpdate', updateHandler);
    };
  }, [editor]);

  // Handle link insertion
  const handleLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    if (previousUrl) {
      // If there's already a link, remove it
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      setLinkUrl('');
      setShowLinkInput(true);
    }
  }, [editor]);

  // Submit link
  const submitLink = useCallback(() => {
    if (linkUrl) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}` })
        .run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  // Handle copy
  const handleCopy = useCallback(() => {
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    navigator.clipboard.writeText(text);
  }, [editor]);

  return (
    <div
      ref={menuRef}
      className="flex items-center gap-0.5 px-1.5 py-1 bg-neutral-900 rounded-lg shadow-xl border border-neutral-700"
      style={{ visibility: 'hidden', position: 'absolute' }}
    >
      {showLinkInput ? (
        <div className="flex items-center gap-1 px-1">
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitLink();
              }
              if (e.key === 'Escape') {
                setShowLinkInput(false);
                setLinkUrl('');
              }
            }}
            placeholder="Enter URL..."
            className="h-6 w-40 px-2 text-xs bg-neutral-800 border border-neutral-600 rounded text-white placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <BubbleButton onClick={submitLink} title="Add link">
            <LinkIcon className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton onClick={() => { setShowLinkInput(false); setLinkUrl(''); }} title="Cancel">
            <X className="h-3.5 w-3.5" />
          </BubbleButton>
        </div>
      ) : (
        <>
          {/* Text formatting */}
          <BubbleButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Underline"
          >
            <Underline className="h-3.5 w-3.5" />
          </BubbleButton>
          <BubbleButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </BubbleButton>

          <div className="w-px h-4 bg-neutral-600 mx-0.5" />

          {/* Link */}
          <BubbleButton
            onClick={handleLink}
            isActive={editor.isActive('link')}
            title={editor.isActive('link') ? 'Remove link' : 'Add link'}
          >
            <LinkIcon className="h-3.5 w-3.5" />
          </BubbleButton>

          {/* Heading */}
          <BubbleButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Heading"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </BubbleButton>

          {/* Quote */}
          <BubbleButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="Quote"
          >
            <Quote className="h-3.5 w-3.5" />
          </BubbleButton>

          {/* Code */}
          <BubbleButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive('code')}
            title="Code"
          >
            <Code className="h-3.5 w-3.5" />
          </BubbleButton>

          <div className="w-px h-4 bg-neutral-600 mx-0.5" />

          {/* Copy */}
          <BubbleButton onClick={handleCopy} title="Copy">
            <Copy className="h-3.5 w-3.5" />
          </BubbleButton>
        </>
      )}
    </div>
  );
}

export { EditorBubbleMenu };
