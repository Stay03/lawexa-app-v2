'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { useSubmitFeedback } from '@/lib/hooks/useFeedback';
import { extractApiError } from '@/lib/utils/api-error';
import {
  FEEDBACK_CATEGORIES,
  MAX_FILES,
  ACCEPT_STRING,
  validateFile,
  buildFeedbackText,
} from './feedback-constants';
import type { FeedbackContext } from '@/types/feedback';

/******************************************************************************
                               Types
******************************************************************************/

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: FeedbackContext;
}

/******************************************************************************
                               Constants
******************************************************************************/

const feedbackFormSchema = z.object({
  categories: z.array(z.string()),
  otherText: z.string().max(4500, 'Feedback text must be 4500 characters or less'),
});

type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Feedback submission dialog with checkboxes, text area, and image upload.
 */
function FeedbackDialog({ open, onOpenChange, context }: FeedbackDialogProps) {
  const submitFeedback = useSubmitFeedback();
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const categories = FEEDBACK_CATEGORIES[context.contentType];
  const contentLabel = context.contentType === 'case' ? 'Case' : 'Note';

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      categories: [],
      otherText: '',
    },
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({ categories: [], otherText: '' });
      setAttachments([]);
    }
  }, [open, form]);

  // Handle file addition with validation
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newFiles = Array.from(files);
      const errors: string[] = [];
      const validFiles: File[] = [];
      for (const file of newFiles) {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
        } else {
          validFiles.push(file);
        }
      }
      if (errors.length > 0) {
        toast.error(errors.join('\n'));
      }
      setAttachments((prev) => {
        const remaining = MAX_FILES - prev.length;
        if (remaining <= 0) {
          toast.error(`Maximum ${MAX_FILES} files allowed`);
          return prev;
        }
        return [...prev, ...validFiles.slice(0, remaining)];
      });
    },
    [],
  );

  const removeFile = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Drag-and-drop handlers scoped to the drop zone
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer?.items.length) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;
      if (e.dataTransfer?.files.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        addFiles(e.target.files);
        e.target.value = '';
      }
    },
    [addFiles],
  );

  const onSubmit = (values: FeedbackFormValues) => {
    // Manual cross-field validation (avoids Zod .refine() type issues)
    if (values.categories.length === 0 && !values.otherText.trim()) {
      form.setError('categories', {
        message: 'Please select at least one issue or provide details',
      });
      return;
    }
    const feedbackText = buildFeedbackText(
      values.categories,
      values.otherText,
      categories,
    );
    submitFeedback.mutate(
      {
        feedback_text: feedbackText,
        content_type: context.contentType,
        content_id: context.contentId,
        attachments: attachments.length > 0 ? attachments : undefined,
      },
      {
        onSuccess: (response) => {
          toast.success(response.message || 'Feedback submitted', {
            description: 'Thank you for helping us improve!',
          });
          onOpenChange(false);
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          if (apiError.errors) {
            Object.entries(apiError.errors).forEach(([field, messages]) => {
              if (field === 'feedback_text') {
                form.setError('otherText', { message: messages[0] });
              }
            });
          } else {
            toast.error(apiError.message);
          }
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Give us a Feedback</DialogTitle>
          <DialogDescription>
            Kindly fill the form to notify us of the problem and we will fix it
            in no time
          </DialogDescription>
        </DialogHeader>

        {/* Content context */}
        <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{contentLabel}:</span>{' '}
          <span className="text-muted-foreground">{context.contentTitle}</span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Checkbox categories */}
            <FormField
              control={form.control}
              name="categories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tick the nature of your problem</FormLabel>
                  <div className="space-y-2">
                    {categories.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex items-center gap-2.5 cursor-pointer"
                      >
                        <Checkbox
                          checked={field.value.includes(cat.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...field.value, cat.id]);
                            } else {
                              field.onChange(
                                field.value.filter((v: string) => v !== cat.id),
                              );
                            }
                          }}
                        />
                        <span className="text-sm">{cat.label}</span>
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Additional details text area */}
            <FormField
              control={form.control}
              name="otherText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional details</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell us more about the issue..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File upload section */}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Attach Screenshots{' '}
                <span className="text-muted-foreground font-normal">
                  (Optional)
                </span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT_STRING}
                onChange={handleFileSelect}
                className="hidden"
              />
              {/* Drop zone */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
              >
                <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">
                  Drag & drop images here
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to browse
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {attachments.length}/{MAX_FILES} images &middot; Max 5MB each
                </p>
              </div>

              {/* File previews */}
              {attachments.length > 0 && (
                <div className="space-y-1.5">
                  {attachments.map((file, i) => (
                    <FilePreview
                      key={`${file.name}-${file.size}-${i}`}
                      file={file}
                      onRemove={() => removeFile(i)}
                    />
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Accepted formats: JPEG, PNG, GIF, WebP (Max 5MB each)
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitFeedback.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitFeedback.isPending}>
                {submitFeedback.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Submit Feedback
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Render a single file preview with thumbnail and remove button.
 */
function FilePreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2 py-1.5">
      {preview ? (
        <img
          src={preview}
          alt={file.name}
          className="h-8 w-8 rounded object-cover"
        />
      ) : (
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
      )}
      <span className="flex-1 truncate text-xs">{file.name}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
        <span className="sr-only">Remove {file.name}</span>
      </Button>
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export { FeedbackDialog };
