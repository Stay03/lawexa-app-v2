'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Copy, ExternalLink, RotateCcw, X as XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePaystackWebhook } from '@/lib/hooks/useAdminPaystackWebhooks';
import { ProcessingStatusBadge } from './ProcessingStatusBadge';
import { PaystackWebhookReplayDialog } from './PaystackWebhookReplayDialog';
import { canReplay, shortSubjectType } from './webhook-meta';

interface PaystackWebhookDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: number | null;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // navigator.clipboard fails in non-secure contexts — no-op.
        }
      }}
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="h-3 w-3" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right max-w-[60%] truncate">
        {children}
      </span>
    </div>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function PaystackWebhookDetailSheet({
  open,
  onOpenChange,
  webhookId,
}: PaystackWebhookDetailSheetProps) {
  const [replayOpen, setReplayOpen] = useState(false);
  const { data, isLoading, error } = usePaystackWebhook(open ? webhookId : null);
  const webhook = data?.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[640px] overflow-y-auto p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            Webhook delivery
            {webhook && (
              <span className="text-xs text-muted-foreground font-normal">
                #{webhook.id}
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            {isLoading ? (
              <Skeleton className="h-4 w-[260px]" />
            ) : webhook ? (
              <span className="font-mono text-xs">{webhook.event_type}</span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3 p-6">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Failed to load this webhook.
          </div>
        ) : webhook ? (
          <div className="space-y-5 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <ProcessingStatusBadge status={webhook.processing_status} />
              <Badge
                variant="outline"
                className={cn(
                  'gap-1',
                  webhook.signature_valid
                    ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950'
                    : 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950'
                )}
              >
                {webhook.signature_valid ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <XIcon className="h-3 w-3" />
                )}
                {webhook.signature_valid ? 'Signature valid' : 'Bad signature'}
              </Badge>
              {webhook.payload_truncated && (
                <Badge
                  variant="outline"
                  className="text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950"
                >
                  Payload truncated
                </Badge>
              )}
              <div className="ml-auto">
                {canReplay(webhook) === 'primary' && (
                  <Button
                    size="sm"
                    onClick={() => setReplayOpen(true)}
                    className="gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Replay
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Summary
              </div>
              <div className="text-sm font-medium leading-snug">
                {webhook.summary}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <MetaRow label="Event id">
                  <span className="font-mono">{webhook.event_id}</span>
                </MetaRow>
                <MetaRow label="Received">
                  {formatDateTime(webhook.created_at)}
                </MetaRow>
                <MetaRow label="Processed">
                  {formatDateTime(webhook.processed_at)}
                </MetaRow>
                <MetaRow label="Replayed">
                  {formatDateTime(webhook.replayed_at)}
                </MetaRow>
                <MetaRow label="Attempts">{webhook.processing_attempts}</MetaRow>
              </div>
              <div>
                <MetaRow label="Payload size">
                  {formatBytes(webhook.payload_size)}
                </MetaRow>
                <MetaRow label="User">
                  {webhook.user ? (
                    <Link
                      href={`/admin/users/${webhook.user.uuid}`}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {webhook.user.name ||
                        webhook.user.email ||
                        `#${webhook.user.id}`}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    '—'
                  )}
                </MetaRow>
                <MetaRow label="Subject">
                  {webhook.subject ? (
                    <span className="font-mono">
                      {shortSubjectType(webhook.subject.type)}#
                      {webhook.subject.id}
                    </span>
                  ) : (
                    '—'
                  )}
                </MetaRow>
                <MetaRow label="Replayed by">
                  {webhook.last_replayed_by
                    ? webhook.last_replayed_by.name ||
                      webhook.last_replayed_by.email ||
                      `#${webhook.last_replayed_by.id}`
                    : '—'}
                </MetaRow>
              </div>
            </div>

            {webhook.error_message && (
              <div>
                <div className="text-xs font-medium mb-1.5 flex items-center justify-between">
                  <span>Error</span>
                  <CopyButton value={webhook.error_message} label="error" />
                </div>
                <pre className="rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 p-3 text-xs text-rose-900 dark:text-rose-200 overflow-x-auto whitespace-pre-wrap break-all">
                  {webhook.error_message}
                </pre>
              </div>
            )}

            <Separator />

            <div>
              <div className="text-xs font-medium mb-1.5 flex items-center justify-between">
                <span>Payload (parsed)</span>
                <CopyButton
                  value={JSON.stringify(webhook.payload, null, 2)}
                  label="parsed payload"
                />
              </div>
              <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto max-h-[420px]">
                {JSON.stringify(webhook.payload, null, 2)}
              </pre>
            </div>

            <details className="rounded-md border">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium hover:bg-accent/50">
                Raw body ({formatBytes(webhook.payload_raw.length)})
              </summary>
              <div className="border-t p-3">
                <div className="flex justify-end mb-1.5">
                  <CopyButton value={webhook.payload_raw} label="raw body" />
                </div>
                <pre className="rounded bg-muted p-3 text-[11px] overflow-x-auto max-h-[300px] whitespace-pre-wrap break-all">
                  {webhook.payload_raw}
                </pre>
              </div>
            </details>

            <details className="rounded-md border">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium hover:bg-accent/50">
                Headers ({Object.keys(webhook.headers).length})
              </summary>
              <div className="border-t p-3">
                <div className="flex justify-end mb-1.5">
                  <CopyButton
                    value={JSON.stringify(webhook.headers, null, 2)}
                    label="headers"
                  />
                </div>
                <pre className="rounded bg-muted p-3 text-[11px] overflow-x-auto max-h-[240px]">
                  {JSON.stringify(webhook.headers, null, 2)}
                </pre>
              </div>
            </details>
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Select a webhook to view details.
          </div>
        )}
      </SheetContent>

      <PaystackWebhookReplayDialog
        open={replayOpen}
        onOpenChange={setReplayOpen}
        webhookId={webhook?.id ?? null}
        eventType={webhook?.event_type ?? null}
        eventId={webhook?.event_id ?? null}
      />
    </Sheet>
  );
}
