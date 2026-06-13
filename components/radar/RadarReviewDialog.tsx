'use client';

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
import { describeCron } from '@/lib/utils/cron';
import type { RadarFormValues } from '@/lib/utils/radar-validation';
import type { Jurisdiction } from '@/types/jurisdiction';

interface RadarReviewDialogProps {
  /** Values to review, or null when the dialog is closed. */
  values: RadarFormValues | null;
  jurisdictions: Jurisdiction[] | undefined;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
      <p className="shrink-0 text-xs font-medium text-muted-foreground sm:w-28 sm:pt-0.5">
        {label}
      </p>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  );
}

/**
 * Pre-create confirmation: a read-only summary of the radar the user is about
 * to create, plus the per-scan billing note. Confirming hands control back to
 * the form's submit path; cancelling returns to the form unchanged.
 */
function RadarReviewDialog({
  values,
  jurisdictions,
  isSubmitting,
  onConfirm,
  onCancel,
}: RadarReviewDialogProps) {
  const jurisdictionNames = values
    ? values.jurisdictions.map(
        (slug) => jurisdictions?.find((j) => j.slug === slug)?.name ?? slug
      )
    : [];

  const scheduleText = values
    ? describeCron(values.schedule_cron) ?? 'Custom schedule'
    : '';

  const extras: string[] = [];
  if (values?.description.trim()) extras.push('Description');
  if (values && values.keywords.length > 0) {
    extras.push(
      `${values.keywords.length} keyword${values.keywords.length === 1 ? '' : 's'}`
    );
  }
  if (values && values.sources.length > 0) {
    extras.push(
      `${values.sources.length} pinned source${values.sources.length === 1 ? '' : 's'}`
    );
  }
  if (values?.instructions.trim()) extras.push('Custom instructions');

  return (
    <Dialog
      open={values !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review your Radar</DialogTitle>
          <DialogDescription>
            Confirm what you&apos;ll be tracking before this Radar is created.
          </DialogDescription>
        </DialogHeader>

        {values && (
          <div className="divide-y rounded-xl border px-4">
            <SummaryRow label="Name">
              {values.name.trim() ? (
                <p className="font-medium">{values.name}</p>
              ) : (
                <p className="text-muted-foreground">
                  Lawexa will name this radar from your topics
                </p>
              )}
            </SummaryRow>
            <SummaryRow label="Jurisdictions">
              {jurisdictionNames.length > 0 ? (
                <p>{jurisdictionNames.join(', ')}</p>
              ) : (
                <p className="text-muted-foreground">Any jurisdiction</p>
              )}
            </SummaryRow>
            <SummaryRow label="Topics">
              {values.topics.length > 0 ? (
                <p>{values.topics.join(', ')}</p>
              ) : (
                <p className="text-muted-foreground">No specific topics</p>
              )}
            </SummaryRow>
            <SummaryRow label="Schedule">
              <p>
                {scheduleText}{' '}
                <span className="text-muted-foreground">
                  ({values.timezone.replace(/_/g, ' ')})
                </span>
              </p>
            </SummaryRow>
            <SummaryRow label="Reports">
              <p>
                {values.email_channel
                  ? 'In-app, notifications, and email'
                  : 'In-app and notifications'}
              </p>
            </SummaryRow>
            <SummaryRow label="First report">
              <p>
                {values.first_scan
                  ? 'Generated now'
                  : 'On the next scheduled scan'}
              </p>
            </SummaryRow>
            {extras.length > 0 && (
              <SummaryRow label="Also set">
                <p>{extras.join(' · ')}</p>
              </SummaryRow>
            )}
          </div>
        )}

        <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          Each Radar scan uses 1 AI message from your plan.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Back
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Create radar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { RadarReviewDialog };
