'use client';

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
import { Loader2 } from 'lucide-react';
import { useReplayPaystackWebhook } from '@/lib/hooks/useAdminPaystackWebhooks';

interface PaystackWebhookReplayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: number | null;
  eventType: string | null;
  eventId: string | null;
}

export function PaystackWebhookReplayDialog({
  open,
  onOpenChange,
  webhookId,
  eventType,
  eventId,
}: PaystackWebhookReplayDialogProps) {
  const replay = useReplayPaystackWebhook();

  function handleReplay() {
    if (!webhookId) return;
    replay.mutate(webhookId, {
      onSuccess: () => onOpenChange(false),
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Replay webhook</AlertDialogTitle>
          <AlertDialogDescription>
            Re-run the handler for{' '}
            <span className="font-mono text-foreground">
              {eventType ?? 'this event'}
            </span>
            {eventId && (
              <>
                {' '}
                (<span className="font-mono text-xs">{eventId}</span>)
              </>
            )}
            . The stored payload will be replayed against the matched handler.
            Handler-level idempotency means already-processed events no-op, so
            this is safe to retry.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={replay.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleReplay}
            disabled={replay.isPending}
          >
            {replay.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Replaying…
              </>
            ) : (
              'Replay'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
