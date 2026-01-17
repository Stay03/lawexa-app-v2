'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Pencil,
  Trash2,
  Share2,
  MoreHorizontal,
  Globe,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { Note } from '@/types/note';
import { useDeleteNote, usePublishNote, useUnpublishNote } from '@/lib/hooks/useNotes';
import { extractApiError } from '@/lib/utils/api-error';
import { getNoteEditUrl } from '@/lib/utils/note-utils';

interface NoteActionsProps {
  note: Note;
  canEdit?: boolean;
  animationDelay?: number;
  className?: string;
}

/**
 * Action buttons for note detail page (edit, delete, share, publish/unpublish)
 */
function NoteActions({
  note,
  canEdit = false,
  animationDelay = 0,
  className,
}: NoteActionsProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  const deleteNote = useDeleteNote();
  const publishNote = usePublishNote();
  const unpublishNote = useUnpublishNote();

  // Handle edit
  const handleEdit = () => {
    router.push(getNoteEditUrl(note));
  };

  // Handle delete
  const handleDelete = async () => {
    try {
      await deleteNote.mutateAsync(note.id);
      toast.success('Note deleted', {
        description: 'Your note has been deleted successfully.',
      });
      router.push('/notes/mine');
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error('Failed to delete note', {
        description: apiError.message,
      });
    }
    setShowDeleteDialog(false);
  };

  // Handle publish/unpublish
  const handleTogglePublish = async () => {
    try {
      if (note.status === 'published') {
        await unpublishNote.mutateAsync(note.id);
        toast.success('Note unpublished', {
          description: 'Your note has been moved to drafts.',
        });
      } else {
        await publishNote.mutateAsync(note.id);
        toast.success('Note published', {
          description: 'Your note is now visible to others.',
        });
      }
    } catch (error) {
      const apiError = extractApiError(error);
      toast.error('Failed to update note', {
        description: apiError.message,
      });
    }
  };

  // Handle share (copy link)
  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied', {
        description: 'Note link has been copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const isProcessing = deleteNote.isPending || publishNote.isPending || unpublishNote.isPending;

  return (
    <>
      <div
        className={cn(
          'animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex items-center gap-2 duration-200',
          className
        )}
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        {/* Share button */}
        <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
          {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          {copied ? 'Copied' : 'Share'}
        </Button>

        {/* Owner actions */}
        {canEdit && (
          <>
            {/* Edit button */}
            <Button variant="outline" size="sm" onClick={handleEdit} className="gap-1.5">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>

            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" disabled={isProcessing}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleTogglePublish} disabled={isProcessing}>
                  {note.status === 'published' ? (
                    <>
                      <EyeOff className="mr-2 h-4 w-4" />
                      Unpublish
                    </>
                  ) : (
                    <>
                      <Globe className="mr-2 h-4 w-4" />
                      Publish
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                  disabled={isProcessing}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your note
              &quot;{note.title}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteNote.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteNote.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteNote.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { NoteActions };
