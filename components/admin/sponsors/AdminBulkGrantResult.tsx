'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import type {
  AdminBulkGrantResult,
  AdminSkipActivePaidSubscription,
  AdminSkipAlreadyInCampaign,
  AdminSkipAlreadyInOtherCampaign,
  AdminSkipCapReached,
  AdminSkipTrialing,
} from '@/types/admin-sponsors';

interface AdminBulkGrantResultProps {
  result: AdminBulkGrantResult;
  onReset: () => void;
}

export function AdminBulkGrantResult({
  result,
  onReset,
}: AdminBulkGrantResultProps) {
  const { granted, skipped, failed } = result;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/30">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-900 dark:text-green-200">
            {granted} grant{granted === 1 ? '' : 's'} issued
          </p>
          <p className="text-xs text-green-800/80 dark:text-green-300/80 mt-0.5">
            Each granted student now has an active subscription for this
            campaign&apos;s plan and duration.
          </p>
        </div>
      </div>

      <SkipBucket
        label="Already granted in this campaign"
        helpText="These users already have an active grant from this campaign — they were not double-granted."
        rows={skipped.already_granted_in_campaign}
        renderRow={(row) => row.email}
      />

      <SkipBucket
        label="Already granted in another campaign"
        helpText="A different active sponsor campaign already covers these users."
        rows={skipped.already_granted_other_campaign}
        renderRow={(row: AdminSkipAlreadyInOtherCampaign) => (
          <span>
            {row.email}
            <span className="ml-2 text-xs text-muted-foreground">
              ({row.campaign_name})
            </span>
          </span>
        )}
      />

      <SkipBucket
        label="Active paid subscription"
        helpText="These users are paying for their own plan and were not granted — they keep their paid plan."
        rows={skipped.active_paid_subscription}
        renderRow={(row: AdminSkipActivePaidSubscription) => (
          <span>
            {row.email}
            <span className="ml-2 text-xs text-muted-foreground">
              ({row.plan}
              {row.ends_at
                ? `, ends ${new Date(row.ends_at).toLocaleDateString()}`
                : ''}
              )
            </span>
          </span>
        )}
      />

      <SkipBucket
        label="On trial"
        helpText="These users are mid-trial. They were not granted to avoid overriding the trial."
        rows={skipped.trialing}
        renderRow={(row: AdminSkipTrialing) => (
          <span>
            {row.email}
            <span className="ml-2 text-xs text-muted-foreground">
              {row.trial_ends_at
                ? `trial ends ${new Date(row.trial_ends_at).toLocaleDateString()}`
                : 'trial active'}
            </span>
          </span>
        )}
      />

      <SkipBucket
        label="Campaign cap reached"
        helpText="The campaign's max_grants limit was hit. Raise the cap or end-and-reissue."
        rows={skipped.cap_reached}
        renderRow={(row: AdminSkipCapReached) => (
          <span>
            {row.email}
            <span className="ml-2 text-xs text-muted-foreground">
              ({row.current_active} / {row.max_grants})
            </span>
          </span>
        )}
      />

      {failed.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-destructive/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm font-semibold text-destructive">
                Needs attention
              </p>
              <Badge variant="destructive" className="text-xs">
                {failed.length}
              </Badge>
            </div>
            <CopyButton
              emails={failed.map((f) => f.email)}
              label={`Copy ${failed.length} email${failed.length === 1 ? '' : 's'}`}
            />
          </div>
          <ul className="divide-y divide-destructive/20 px-4 py-2 text-sm">
            {failed.map((row, i) => (
              <li
                key={`${row.email}-${i}`}
                className="py-2 flex justify-between gap-3"
              >
                <span className="font-medium truncate">{row.email}</span>
                <span className="text-xs text-destructive shrink-0">
                  {row.error}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button variant="outline" onClick={onReset}>
          Grant more
        </Button>
      </div>
    </div>
  );
}

/******************************************************************************
                              Helper components
******************************************************************************/

interface SkipBucketProps<T extends { email: string }> {
  label: string;
  helpText: string;
  rows: T[];
  renderRow: (row: T) => React.ReactNode;
}

function SkipBucket<T extends { email: string }>({
  label,
  helpText,
  rows,
  renderRow,
}: SkipBucketProps<T>) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-2 text-left">
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">{label}</span>
            <Badge variant="outline" className="text-xs">
              {rows.length}
            </Badge>
          </div>
          <CopyButton
            emails={rows.map((r) => r.email)}
            label={`Copy ${rows.length}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-4 py-3 space-y-2">
          <p className="text-xs text-muted-foreground">{helpText}</p>
          <ul
            className={cn(
              'divide-y divide-border text-sm',
              rows.length > 8 && 'max-h-64 overflow-y-auto'
            )}
          >
            {rows.map((row, i) => (
              <li key={`${row.email}-${i}`} className="py-1.5">
                {renderRow(row)}
              </li>
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Shows email rendering as plain text + a Copy emails button on demand.
 * Note: nested clickable inside CollapsibleTrigger — we stop propagation.
 */
function CopyButton({ emails, label }: { emails: string[]; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard
          .writeText(emails.join('\n'))
          .then(() => toast.success(`Copied ${emails.length} to clipboard`))
          .catch(() => toast.error('Copy failed'));
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <Copy className="h-3 w-3" />
      {label}
    </button>
  );
}

/******************************************************************************
                       Backward-compat helper for SkipBucket
       Earlier renderRow callbacks reference rows by type — we accept any
       row with at least an `email` field.
******************************************************************************/

// Type re-export for callers that compose buckets externally.
export type { AdminSkipAlreadyInCampaign };
