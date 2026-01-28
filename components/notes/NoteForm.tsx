'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Editor } from '@tiptap/react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NoteEditor, type NoteEditorRef } from './NoteEditor';
import { EditorToolbar } from './EditorToolbar';
import { WriterModeToggle } from './WriterModeToggle';
import { createNoteSchema, type CreateNoteFormData } from '@/lib/utils/note-validation';
import { useUploadContentImage } from '@/lib/hooks/useNotes';
import { useWriterMode } from '@/lib/hooks/useWriterMode';
import { useAutoSave } from '@/lib/hooks/useAutoSave';
import type { Note } from '@/types/note';

interface NoteFormProps {
  initialData?: Partial<Note>;
  onSubmit: (data: CreateNoteFormData) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

/**
 * Minimal note editor form with publish dialog and auto-save
 */
function NoteForm({
  initialData,
  onSubmit,
  isSubmitting = false,
}: NoteFormProps) {
  const router = useRouter();
  const uploadImage = useUploadContentImage();
  const { isWriterModeEnabled, disableWriterMode } = useWriterMode();
  const [mounted, setMounted] = useState(false);
  const [isNavigatingToPublish, setIsNavigatingToPublish] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [characterCount, setCharacterCount] = useState(0);
  const editorRef = useRef<NoteEditorRef>(null);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Show writer mode when enabled (after hydration)
  const showWriterMode = mounted && isWriterModeEnabled;

  // Initialize form with just title and content for validation
  const form = useForm<CreateNoteFormData>({
    resolver: zodResolver(createNoteSchema),
    defaultValues: {
      title: initialData?.title || '',
      content: initialData?.content || '',
      is_private: initialData?.is_private || false,
      tags: initialData?.tags?.join(', ') || '',
      price_ngn: initialData?.price_ngn ? parseFloat(initialData.price_ngn) : undefined,
      price_usd: initialData?.price_usd ? parseFloat(initialData.price_usd) : undefined,
      status: initialData?.status || 'draft',
    },
  });

  // Auto-save hook
  const {
    saveStatus,
    lastSavedText,
    noteSlug,
    triggerSave,
    saveImmediately,
  } = useAutoSave({
    existingNote: initialData,
    debounceMs: 2000,
    enabled: true,
  });

  // Subscribe to form changes for auto-save (without causing re-renders)
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (mounted) {
        triggerSave({ title: values.title || '', content: values.content || '' });
      }
    });
    return () => subscription.unsubscribe();
  }, [form, mounted, triggerSave]);

  // Handle editor ready - store editor instance for toolbar access
  const handleEditorReady = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance);
  }, []);

  // Update character count when content changes (debounced to avoid lag)
  useEffect(() => {
    if (editor) {
      let timeoutId: NodeJS.Timeout;
      const updateCharCount = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setCharacterCount(editor.getText().length);
        }, 300);
      };
      updateCharCount();
      editor.on('update', updateCharCount);
      return () => {
        editor.off('update', updateCharCount);
        clearTimeout(timeoutId);
      };
    }
  }, [editor]);

  // Handle Escape key to exit writer mode
  useEffect(() => {
    if (!showWriterMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        disableWriterMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showWriterMode, disableWriterMode]);

  // Handle image upload for editor
  const handleImageUpload = useCallback(
    async (file: File): Promise<string> => {
      const result = await uploadImage.mutateAsync(file);
      return result.data.url;
    },
    [uploadImage]
  );

  // Handle publish button click - save and navigate to publish page
  const handlePublishClick = async () => {
    // Validate title and content
    const isValid = await form.trigger(['title', 'content']);
    if (!isValid) return;

    setIsNavigatingToPublish(true);

    try {
      const title = form.getValues('title');
      const content = form.getValues('content');

      // If we already have a slug (existing note or auto-saved), use it
      // Otherwise, save immediately to get a slug
      let slugToUse: string | undefined = noteSlug || initialData?.slug || undefined;

      if (!slugToUse) {
        // Force save to get a slug for new notes
        const savedSlug = await saveImmediately({ title, content });
        if (!savedSlug) {
          toast.error('Failed to save note', {
            description: 'Please try again.',
          });
          setIsNavigatingToPublish(false);
          return;
        }
        slugToUse = savedSlug;
      }

      // Navigate to the appropriate publish page
      if (initialData?.slug) {
        // Editing existing note
        router.push(`/notes/${initialData.slug}/publish`);
      } else {
        // New note - use the slug from auto-save
        router.push(`/notes/publish?slug=${slugToUse}`);
      }
    } catch {
      toast.error('Failed to save note', {
        description: 'Please try again.',
      });
      setIsNavigatingToPublish(false);
    }
  };

  // Get save status display
  const getSaveStatusDisplay = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </span>
        );
      case 'saved':
        return (
          <span className="text-sm text-muted-foreground">
            {lastSavedText}
          </span>
        );
      case 'error':
        return (
          <span className="text-sm text-destructive">
            Failed to save
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-border mb-8">
        {/* Left: Save status */}
        <div className="flex items-center gap-4">
          {getSaveStatusDisplay()}
        </div>

        {/* Right: Note Mode + Publish */}
        <div className="flex items-center gap-2">
          <WriterModeToggle />
          <Button
            onClick={handlePublishClick}
            disabled={isSubmitting || isNavigatingToPublish}
            className="bg-green-600 hover:bg-green-700 text-white rounded-full px-6"
          >
            {isNavigatingToPublish && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish
          </Button>
        </div>
      </div>

      {/* Toolbar - only in writer mode, below header, sticky */}
      {showWriterMode && editor && (
        <div className="sticky top-0 z-10 bg-background mb-4">
          <EditorToolbar
            editor={editor}
            onImageUpload={handleImageUpload}
          />
        </div>
      )}

      {/* Paper container wrapper in writer mode, normal layout otherwise */}
      <div
        className={cn(
          showWriterMode && [
            'bg-white rounded-lg shadow-sm',
            'border border-neutral-200',
            'p-6 sm:p-8 md:p-12',
            'min-h-[70vh]',
          ]
        )}
      >
        <Form {...form}>
          <form>
            {/* Title input */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className={showWriterMode ? 'mb-0' : 'mb-8'}>
                  <FormControl>
                    <textarea
                      placeholder="Title"
                      {...field}
                      disabled={isSubmitting}
                      rows={1}
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto';
                          el.style.height = `${el.scrollHeight}px`;
                        }
                      }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                      className={cn(
                        'w-full border-0 font-serif focus:outline-none bg-transparent leading-tight resize-none overflow-hidden',
                        showWriterMode
                          ? 'text-3xl sm:text-4xl md:text-[48px] text-neutral-900 placeholder:text-neutral-400'
                          : 'text-[48px] placeholder:text-muted-foreground/40'
                      )}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Divider - only in writer mode */}
            {showWriterMode && <div className="h-px bg-neutral-200 my-6" />}

            {/* Content Editor */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <NoteEditor
                      ref={editorRef}
                      content={field.value}
                      onChange={field.onChange}
                      placeholder="Note it down"
                      onImageUpload={handleImageUpload}
                      showToolbar={!showWriterMode}
                      onEditorReady={handleEditorReady}
                      forceLight={showWriterMode}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>

      {/* Character count & Escape hint - only in writer mode */}
      {showWriterMode && (
        <>
          <div className="fixed bottom-4 right-4 bg-card/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-border">
            <span className="text-sm text-muted-foreground">
              {characterCount.toLocaleString()}/65,535
            </span>
          </div>
          <div className="fixed bottom-4 left-4 bg-card/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-border">
            <span className="text-xs text-muted-foreground">
              Press{' '}
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-muted-foreground font-mono">
                Esc
              </kbd>{' '}
              to exit
            </span>
          </div>
        </>
      )}
    </>
  );
}

export { NoteForm };
