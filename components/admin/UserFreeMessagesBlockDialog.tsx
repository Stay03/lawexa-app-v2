'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useSetUserFreeMessagesBlock } from '@/lib/hooks/useAdmin';
import { extractApiError } from '@/lib/utils/api-error';
import { cn } from '@/lib/utils';

/** Matches the backend's 500-char cap on the audit note (422 if exceeded). */
const REASON_MAX = 500;

interface UserFreeMessagesBlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { uuid: string; name: string; free_messages_blocked: boolean } | null;
}

/**
 * Confirm dialog for the admin block/unblock-free-messages action.
 *
 * The flag is source-neutral, so the copy avoids implying "manual" — unblocking
 * also lifts an automatic device-abuse flag. The reason note is only collected
 * when blocking and is purely for the audit log.
 */
export function UserFreeMessagesBlockDialog({
  open,
  onOpenChange,
  user,
}: UserFreeMessagesBlockDialogProps) {
  const [reason, setReason] = useState('');
  const mutation = useSetUserFreeMessagesBlock();

  const willBlock = !(user?.free_messages_blocked ?? false);
  const overLimit = reason.length > REASON_MAX;

  // Reset the note as the dialog closes — done here rather than in an effect to
  // avoid setState-in-effect.
  const handleOpenChange = (next: boolean) => {
    if (!next) setReason('');
    onOpenChange(next);
  };

  const handleConfirm = () => {
    if (!user || overLimit) return;
    const trimmed = reason.trim();

    mutation.mutate(
      {
        uuid: user.uuid,
        payload: willBlock
          ? { blocked: true, ...(trimmed ? { reason: trimmed } : {}) }
          : { blocked: false },
      },
      {
        onSuccess: (response) => {
          toast.success(response.message);
          handleOpenChange(false);
        },
        onError: (error) => {
          toast.error(extractApiError(error).message);
        },
      }
    );
  };

  if (!user) return null;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {willBlock ? 'Block free messages' : 'Unblock free messages'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {willBlock ? (
                <p>
                  Block free AI messages for{' '}
                  <span className="font-semibold text-foreground">
                    {user.name}
                  </span>
                  ? They&apos;ll get the same experience as a user who&apos;s out
                  of messages. A paid subscription still overrides the block.
                </p>
              ) : (
                <p>
                  Restore free AI messages for{' '}
                  <span className="font-semibold text-foreground">
                    {user.name}
                  </span>
                  ? This also clears an automatic device-abuse flag if one is set.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {willBlock && (
          <div className="space-y-1.5">
            <Label htmlFor="block-reason" className="text-sm">
              Reason{' '}
              <span className="font-normal text-muted-foreground">
                (optional, for the audit log)
              </span>
            </Label>
            <Textarea
              id="block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Multiple accounts created from one device"
              rows={3}
            />
            <p
              className={cn(
                'text-right text-xs',
                overLimit ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {reason.length}/{REASON_MAX}
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant={willBlock ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={mutation.isPending || overLimit}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {willBlock ? 'Block messages' : 'Unblock messages'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
