'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
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
  AdminCampaignType,
  AdminSkipActivePaidSubscription,
  AdminSkipAlreadyInCampaign,
  AdminSkipAlreadyInOtherCampaign,
  AdminSkipCapReached,
  AdminSkipTrialing,
} from '@/types/admin-sponsors';

interface AdminBulkGrantResultProps {
  result: AdminBulkGrantResult;
  onReset: () => void;
  campaignType: AdminCampaignType;
  packSize: number | null;
}

export function AdminBulkGrantResult({
  result,
  onReset,
  campaignType,
  packSize,
}: AdminBulkGrantResultProps) {
  const { granted, skipped, failed } = result;
  const isPack = campaignType === 'pack';

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/30">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-900 dark:text-green-200">
            {granted} grant{granted === 1 ? '' : 's'} issued
          </p>
          <p className="text-xs text-green-800/80 dark:text-green-300/80 mt-0.5">
            {isPack
              ? `Each granted student now has a pack of ${packSize?.toLocaleString() ?? ''} messages on top of any existing quota.`
              : "Each granted student now has an active subscription for this campaign's plan and duration."}
          </p>
        </div>
      </div>

      <SkipBucket
        label="Already granted in this campaign"
        helpText="These users already have an active grant from this campaign — they were not double-granted."
        rows={skipped.already_granted_in_campaign}
        renderRow={(row) => (
          <UserRow email={row.email} userUuid={row.user_uuid} />
        )}
      />

      <SkipBucket
        label="Already granted in another campaign"
        helpText="A different active sponsor campaign already covers these users."
        rows={skipped.already_granted_other_campaign}
        renderRow={(row: AdminSkipAlreadyInOtherCampaign) => (
          <UserRow
            email={row.email}
            userUuid={row.user_uuid}
            detail={row.campaign_name}
          />
        )}
      />

      <SkipBucket
        label="Active paid subscription"
        helpText="These users are paying for their own plan and were not granted — they keep their paid plan."
        rows={skipped.active_paid_subscription}
        renderRow={(row: AdminSkipActivePaidSubscription) => (
          <UserRow
            email={row.email}
            userUuid={row.user_uuid}
            detail={`${row.plan}${
              row.ends_at
                ? `, ends ${new Date(row.ends_at).toLocaleDateString()}`
                : ''
            }`}
          />
        )}
      />

      <SkipBucket
        label="On trial"
        helpText="These users are mid-trial. They were not granted to avoid overriding the trial."
        rows={skipped.trialing}
        renderRow={(row: AdminSkipTrialing) => (
          <UserRow
            email={row.email}
            userUuid={row.user_uuid}
            detail={
              row.trial_ends_at
                ? `trial ends ${new Date(row.trial_ends_at).toLocaleDateString()}`
                : 'trial active'
            }
          />
        )}
      />

      <SkipBucket
        label="Campaign cap reached"
        helpText="The campaign's max_grants limit was hit. Raise the cap or end-and-reissue."
        rows={skipped.cap_reached}
        renderRow={(row: AdminSkipCapReached) => (
          <UserRow
            email={row.email}
            userUuid={row.user_uuid}
            detail={`${row.current_active} / ${row.max_grants}`}
          />
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
                <UserRow email={row.email} userUuid={row.user_uuid} />
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
 * Row showing an email plus, when the user resolved server-side, a profile
 * link via user_uuid. Used by every skip bucket and the failed list.
 */
function UserRow({
  email,
  userUuid,
  detail,
}: {
  email: string;
  userUuid: string | null;
  detail?: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
      <span className="font-medium truncate">{email}</span>
      {userUuid && (
        <Link
          href={`/admin/users/${userUuid}`}
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Profile
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
      {detail && (
        <span className="text-xs text-muted-foreground">({detail})</span>
      )}
    </span>
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
