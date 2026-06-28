'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { extractApiError } from '@/lib/utils/api-error';
import {
  useApproveAdminQuizQuestion,
  useArchiveAdminQuizQuestion,
  useDeleteAdminQuizQuestion,
  useRestoreAdminQuizQuestion,
} from '@/lib/hooks/useAdminQuiz';

export type AdminQuizAction = 'approve' | 'archive' | 'delete' | 'restore';

const COPY: Record<
  AdminQuizAction,
  { title: string; description: string; confirm: string; verb: string; destructive?: boolean }
> = {
  approve: {
    title: 'Approve question?',
    description: 'It becomes servable in quizzes.',
    confirm: 'Approve',
    verb: 'approved',
  },
  archive: {
    title: 'Archive question?',
    description: 'It will be hidden from quizzes. You can approve it again later.',
    confirm: 'Archive',
    verb: 'archived',
  },
  restore: {
    title: 'Restore question?',
    description: 'Un-deletes the question and returns it to the bank.',
    confirm: 'Restore',
    verb: 'restored',
  },
  delete: {
    title: 'Delete question?',
    description: 'Soft-deletes the question — you can restore it later.',
    confirm: 'Delete',
    verb: 'deleted',
    destructive: true,
  },
};

interface AdminQuizActionDialogProps {
  action: AdminQuizAction | null;
  question: { uuid: string; question_text: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful action (e.g. to navigate away from a detail page). */
  onSuccess?: () => void;
}

/** Confirmation dialog for the four status actions, with an optional note. */
export function AdminQuizActionDialog({
  action,
  question,
  open,
  onOpenChange,
  onSuccess,
}: AdminQuizActionDialogProps) {
  const [notes, setNotes] = useState('');
  const approve = useApproveAdminQuizQuestion();
  const archive = useArchiveAdminQuizQuestion();
  const restore = useRestoreAdminQuizQuestion();
  const del = useDeleteAdminQuizQuestion();

  const pending =
    approve.isPending || archive.isPending || restore.isPending || del.isPending;

  if (!action || !question) return null;

  const copy = COPY[action];
  const showNotes = action !== 'delete';

  const finish = () => {
    toast.success(`Question ${copy.verb}.`);
    setNotes('');
    onOpenChange(false);
    onSuccess?.();
  };
  const fail = (error: unknown) =>
    toast.error('Action failed', { description: extractApiError(error).message });

  const handleConfirm = () => {
    const moderation_notes = notes.trim() || undefined;
    if (action === 'approve')
      approve.mutate({ uuid: question.uuid, moderation_notes }, { onSuccess: finish, onError: fail });
    else if (action === 'archive')
      archive.mutate({ uuid: question.uuid, moderation_notes }, { onSuccess: finish, onError: fail });
    else if (action === 'restore')
      restore.mutate({ uuid: question.uuid, moderation_notes }, { onSuccess: finish, onError: fail });
    else del.mutate(question.uuid, { onSuccess: finish, onError: fail });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        if (!o) setNotes('');
        onOpenChange(o);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {showNotes && (
          <div className="space-y-1.5 text-left">
            <Label htmlFor="moderation-notes" className="text-xs text-muted-foreground">
              Moderation note (optional)
            </Label>
            <Textarea
              id="moderation-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Why are you making this change?"
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={copy.destructive ? 'destructive' : 'default'}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={pending}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
