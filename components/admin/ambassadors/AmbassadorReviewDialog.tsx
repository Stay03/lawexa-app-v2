'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

import { useApproveAmbassador, useRejectAmbassador } from '@/lib/hooks/useAdminAmbassadors';
import { extractApiError } from '@/lib/utils/api-error';
import type { AmbassadorApplication, AmbassadorStatus } from '@/types/ambassador';

const statusVariant: Record<AmbassadorStatus, 'secondary' | 'default' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{value}</div>
    </div>
  );
}

interface AmbassadorReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: AmbassadorApplication | null;
  onSuccess?: () => void;
}

export function AmbassadorReviewDialog({
  open,
  onOpenChange,
  application,
  onSuccess,
}: AmbassadorReviewDialogProps) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const approveMutation = useApproveAmbassador();
  const rejectMutation = useRejectAmbassador();

  // Reset on close (event-driven, not an effect) so the next open starts clean.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setNotes('');
      setError(null);
    }
    onOpenChange(next);
  };

  if (!application) return null;
  const a = application;
  const pending = a.status === 'pending';
  const busy = approveMutation.isPending || rejectMutation.isPending;

  const decideError = (e: unknown) => {
    const err = extractApiError(e);
    if (err.status === 409) toast.error('This application has already been decided.');
    else toast.error(err.message || 'Something went wrong.');
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveMutation.mutateAsync({ uuid: a.uuid, data: { review_notes: notes.trim() || undefined } });
      toast.success(`Approved ${a.name}’s application`);
      handleOpenChange(false);
      onSuccess?.();
    } catch (e) {
      decideError(e);
    }
  };

  const handleReject = async () => {
    if (!notes.trim()) {
      setError('A reason is required to reject.');
      return;
    }
    setError(null);
    try {
      await rejectMutation.mutateAsync({ uuid: a.uuid, data: { review_notes: notes.trim() } });
      toast.success(`Rejected ${a.name}’s application`);
      handleOpenChange(false);
      onSuccess?.();
    } catch (e) {
      decideError(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {a.name}
            <Badge variant={statusVariant[a.status]}>{a.status_label || a.status}</Badge>
          </DialogTitle>
          <DialogDescription>
            {a.email} · {a.phone}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Country" value={a.country} />
            <Field label="University" value={a.university} />
            <Field label="Law school" value={a.law_school} />
            <Field label="Faculty" value={a.faculty} />
            <Field label="Level" value={a.level} />
            <Field label="Social" value={a.social_handle} />
          </div>
          <Field label="Motivation" value={a.motivation} />
          <Field label="Growth plan" value={a.growth_plan} />
          <Field label="Leadership / community experience" value={a.leadership_experience} />
          <Field label="How they heard about us" value={a.heard_from} />

          {!pending && (
            <div className="rounded-md border bg-muted/40 p-3">
              <Field label="Review notes" value={a.review_notes || '—'} />
              {a.reviewed_at && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Reviewed {new Date(a.reviewed_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {pending && (
            <div>
              <label className="text-sm font-medium">
                Review notes <span className="font-normal text-muted-foreground">(required to reject)</span>
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note for approval; required reason for rejection…"
                className="mt-1.5 min-h-[90px]"
                maxLength={2000}
              />
              {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
            </div>
          )}
        </div>

        {pending && (
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={handleReject} disabled={busy}>
              {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
            </Button>
            <Button onClick={handleApprove} disabled={busy}>
              {approveMutation.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
