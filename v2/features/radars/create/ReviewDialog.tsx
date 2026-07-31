'use client';

import { useQuery } from '@tanstack/react-query';
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
import { describeCron, estimateScansPerMonth } from '@/lib/utils/cron';
import { jurisdictionsQueries } from '@/v2/features/jurisdictions/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import type { RadarFormValues } from './form-model';
import { userLimitsQuery } from './user-limits';

/**
 * ReviewDialog — the pre-create confirmation: a read-only summary of the
 * radar about to exist, and the COST STATED HONESTLY in one place. v1 spread
 * the money facts across the form (a "messages left" aside on the timezone
 * line, the per-scan note in the dialog); per the study they live together
 * here: what this schedule costs per month, what one scan costs, and what the
 * account has left.
 *
 * Confirming hands control back to the form's submit path; cancelling returns
 * to the form unchanged.
 */

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

export function ReviewDialog({
  values,
  jurisdictionSlugs,
  timezone,
  isSubmitting,
  onConfirm,
  onCancel,
}: {
  /** Values to review, or null when the dialog is closed. */
  values: RadarFormValues | null;
  /** The EFFECTIVE jurisdiction selection (incl. the untouched default). */
  jurisdictionSlugs: string[];
  /** The RESOLVED timezone (stored pick, else the device zone). */
  timezone: string;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { userId: viewerId } = useV2Session();
  // The list is static-tier and already cached by the field's own picker —
  // this read costs nothing new.
  const { data: jurisdictions } = useQuery({
    ...jurisdictionsQueries.list(),
    enabled: values !== null,
  });
  const { data: limitsData } = useQuery({
    ...userLimitsQuery({ viewerId }),
    enabled: values !== null,
  });

  const jurisdictionNames = jurisdictionSlugs.map(
    (slug) =>
      jurisdictions?.find((jurisdiction) => jurisdiction.slug === slug)?.name ??
      slug,
  );

  const scheduleText = values
    ? (describeCron(values.scheduleCron) ?? 'Custom schedule')
    : '';
  const scansPerMonth = values
    ? estimateScansPerMonth(values.scheduleCron)
    : null;
  const messagesRemaining =
    limitsData?.data?.ai_messages.total_remaining ?? null;

  const extras: string[] = [];
  if (values?.description.trim()) extras.push('Description');
  if (values && values.keywords.length > 0) {
    extras.push(
      `${values.keywords.length} keyword${values.keywords.length === 1 ? '' : 's'}`,
    );
  }
  if (values && values.sources.length > 0) {
    extras.push(
      `${values.sources.length} pinned source${values.sources.length === 1 ? '' : 's'}`,
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
          <DialogTitle>Review your radar</DialogTitle>
          <DialogDescription>
            Confirm what you&apos;ll be tracking before this radar is created.
          </DialogDescription>
        </DialogHeader>

        {values ? (
          <div className="divide-y rounded-xl border px-4">
            <SummaryRow label="Name">
              <p className="text-muted-foreground">
                Lawexa will name this radar from your topics
              </p>
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
                  ({timezone.replace(/_/g, ' ')})
                </span>
              </p>
            </SummaryRow>
            <SummaryRow label="Reports">
              <p>
                {values.emailChannel
                  ? 'In-app, notifications, and email'
                  : 'In-app and notifications'}
              </p>
            </SummaryRow>
            <SummaryRow label="First report">
              <p>
                {values.firstScan ? 'Generated now' : 'On the next scheduled scan'}
              </p>
            </SummaryRow>
            {extras.length > 0 ? (
              <SummaryRow label="Also set">
                <p>{extras.join(' · ')}</p>
              </SummaryRow>
            ) : null}
          </div>
        ) : null}

        {/* The money, in one place: cadence cost, unit cost, balance. */}
        <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          <p>
            Each scan uses 1 AI message from your plan
            {scansPerMonth !== null && scansPerMonth > 0 ? (
              <>
                {' '}
                — this schedule runs about{' '}
                <span className="font-medium text-foreground">
                  {scansPerMonth < 1
                    ? '1 scan every few months'
                    : `${Math.round(scansPerMonth)} scan${Math.round(scansPerMonth) === 1 ? '' : 's'} a month`}
                </span>
                .
              </>
            ) : (
              '.'
            )}
            {messagesRemaining !== null ? (
              <>
                {' '}
                You have{' '}
                <span className="font-medium tabular-nums text-foreground">
                  {messagesRemaining}
                </span>{' '}
                message{messagesRemaining === 1 ? '' : 's'} left.
              </>
            ) : null}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Back
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : null}
            Create radar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
