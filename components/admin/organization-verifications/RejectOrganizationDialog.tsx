'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { extractApiError } from '@/lib/utils/api-error';
import { useRejectOrganization } from '@/lib/hooks/useAdminOrganizationVerificationActions';

const MAX_REASON = 1000;

/**
 * Refusing an application, with the reason that goes to the company.
 *
 * ── THE READER IS TOLD WHERE THE WORDS GO ──────────────────────────────────
 * The reason is emailed to whoever applied. Somebody typing "wrong doc" into a
 * box that says nothing would not have chosen those words if they knew a
 * stranger reads them, so the box says so before they type.
 *
 * ── AND THAT IT CAN BE UNDONE ──────────────────────────────────────────────
 * Until 17 August 2026 rejecting DESTROYED the application: document deleted,
 * number wiped, nothing to look back at. It now records the decision and lets
 * the company apply again. That is worth stating on the screen, because an
 * admin who believes a button is final hesitates over it, and hesitating over
 * this one means leaving a real company waiting.
 */
export function RejectOrganizationDialog({
  uuid,
  name,
  open,
  onOpenChange,
  onRejected,
}: {
  uuid: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRejected?: () => void;
}) {
  const [reason, setReason] = useState('');
  const reject = useRejectOrganization(uuid);

  const trimmed = reason.trim();
  const tooLong = reason.length > MAX_REASON;
  const canSend = trimmed.length > 0 && !tooLong && !reject.isPending;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason('');
      reject.reset();
    }
    onOpenChange(next);
  };

  const handleReject = () => {
    if (!canSend) return;
    reject.mutate(trimmed, {
      onSuccess: () => {
        handleOpenChange(false);
        onRejected?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refuse {name}&rsquo;s verification</DialogTitle>
          <DialogDescription>
            Your reason is emailed to the person who applied, so write it for
            them. They can fix it and apply again, and nothing they sent is
            deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reject-reason">Reason</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What was wrong, and what would make it right."
            className="min-h-28"
            aria-invalid={tooLong ? true : undefined}
          />
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              Required. It is the only thing they are told.
            </span>
            <span
              className={
                tooLong
                  ? 'font-medium text-destructive tabular-nums'
                  : 'text-muted-foreground tabular-nums'
              }
            >
              {reason.length}/{MAX_REASON}
            </span>
          </div>
          {reject.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {extractApiError(reject.error).message}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={reject.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleReject}
            disabled={!canSend}
          >
            {reject.isPending ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : null}
            {reject.isPending ? 'Sending' : 'Refuse and email them'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
