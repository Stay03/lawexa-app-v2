'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  Paperclip,
  UserX,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type { AdminMessageRow } from '@/types/admin-messages';
import {
  ROLE_LABEL,
  ROLE_TONE,
  SENT_VIA_LABEL,
  SENT_VIA_TONE,
  formatBytes,
} from './message-meta';

interface MessageDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: AdminMessageRow | null;
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
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
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
      <span className="text-xs font-medium text-right max-w-[60%] break-all">
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

export function MessageDetailSheet({
  open,
  onOpenChange,
  row,
}: MessageDetailSheetProps) {
  const { showNGN, exchangeRate } = useCurrencyStore();
  const costOptions = { showNGN, exchangeRate };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[640px] overflow-y-auto p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            Message
            {row && (
              <span className="text-xs text-muted-foreground font-normal">
                #{row.id}
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            {row ? (
              <span className="inline-flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn('text-[10px]', ROLE_TONE[row.role])}
                >
                  {ROLE_LABEL[row.role]}
                </Badge>
                <span className="text-xs">{formatDateTime(row.created_at)}</span>
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        {row ? (
          <div className="space-y-5 p-6">
            <section className="rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between border-b px-4 py-2">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Content
                </span>
                {row.content && (
                  <CopyButton value={row.content} label="content" />
                )}
              </div>
              <pre className="px-4 py-3 text-sm whitespace-pre-wrap break-words font-sans leading-snug">
                {row.content || '(empty content)'}
              </pre>
            </section>

            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <MetaRow label="User">
                  <Link
                    href={`/admin/users/${row.user.uuid}`}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    {row.user.name || row.user.email || row.user.uuid}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </MetaRow>
                <MetaRow label="Email">
                  <span className="font-mono">{row.user.email ?? '—'}</span>
                </MetaRow>
                <MetaRow label="User UUID">
                  <span className="font-mono text-[10px]">
                    {row.user.uuid}
                  </span>
                </MetaRow>
                {row.user.deleted_at && (
                  <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                    <UserX className="h-3 w-3" />
                    Account deleted {formatDateTime(row.user.deleted_at)}
                  </div>
                )}
              </div>
              <div>
                <MetaRow label="Conversation">
                  <Link
                    href={`/admin/conversations/${row.conversation.uuid}`}
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <MessageSquare className="h-3 w-3" />
                    {row.conversation.title || 'Untitled'}
                  </Link>
                </MetaRow>
                <MetaRow label="Conversation UUID">
                  <span className="font-mono text-[10px]">
                    {row.conversation.uuid}
                  </span>
                </MetaRow>
                <MetaRow label="Created">
                  {formatDateTime(row.created_at)}
                </MetaRow>
                <MetaRow label="Agent">
                  {row.agent_id !== null ? `#${row.agent_id}` : '—'}
                </MetaRow>
              </div>
            </div>

            {row.attachment && (
              <section className="rounded-lg border bg-muted/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {row.attachment.file_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatBytes(row.attachment.file_size)}
                      <span className="ml-2 font-mono">
                        {row.attachment.file_id}
                      </span>
                    </p>
                  </div>
                </div>
              </section>
            )}

            {row.usage && (
              <section>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                  Usage
                </div>
                <div className="grid grid-cols-2 gap-x-6 rounded-lg border bg-muted/20 p-3 sm:grid-cols-5">
                  <UsageCell
                    label="Prompt"
                    value={row.usage.prompt_tokens.toLocaleString()}
                  />
                  <UsageCell
                    label="Completion"
                    value={row.usage.completion_tokens.toLocaleString()}
                  />
                  <UsageCell
                    label="Total"
                    value={row.usage.total_tokens.toLocaleString()}
                  />
                  <UsageCell
                    label="Latency"
                    value={`${row.usage.latency_ms} ms`}
                  />
                  <UsageCell
                    label="Cost"
                    value={formatCost(row.usage.estimated_cost, costOptions)}
                  />
                </div>
              </section>
            )}

            {row.attribution && (
              <section>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                  Funding attribution
                </div>
                <div className="rounded-lg border p-3 space-y-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      SENT_VIA_TONE[row.attribution.kind]
                    )}
                  >
                    {SENT_VIA_LABEL[row.attribution.kind]}
                  </Badge>
                  <div className="grid grid-cols-2 gap-x-6 text-xs">
                    {row.attribution.plan && (
                      <MetaRow label="Plan">{row.attribution.plan.name}</MetaRow>
                    )}
                    {row.attribution.subscription && (
                      <MetaRow label="Subscription">
                        #{row.attribution.subscription.id}
                        <span className="ml-1 text-muted-foreground font-normal">
                          ({row.attribution.subscription.provider})
                        </span>
                      </MetaRow>
                    )}
                    {row.attribution.message_pack && (
                      <MetaRow label="Message pack">
                        {row.attribution.message_pack.name}
                      </MetaRow>
                    )}
                    {row.attribution.sponsor && (
                      <MetaRow label="Sponsor">
                        <Link
                          href={`/admin/sponsors/${row.attribution.sponsor.id}`}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          {row.attribution.sponsor.name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </MetaRow>
                    )}
                    {row.attribution.campaign && (
                      <MetaRow label="Campaign">
                        <Link
                          href={`/admin/campaigns/${row.attribution.campaign.id}`}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          {row.attribution.campaign.name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </MetaRow>
                    )}
                  </div>
                </div>
              </section>
            )}

            {row.metadata && Object.keys(row.metadata).length > 0 && (
              <>
                <Separator />
                <details className="rounded-md border">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium hover:bg-accent/50">
                    Metadata
                  </summary>
                  <div className="border-t p-3">
                    <div className="flex justify-end mb-1.5">
                      <CopyButton
                        value={JSON.stringify(row.metadata, null, 2)}
                        label="metadata"
                      />
                    </div>
                    <pre className="rounded bg-muted p-3 text-[11px] overflow-x-auto max-h-[300px]">
                      {JSON.stringify(row.metadata, null, 2)}
                    </pre>
                  </div>
                </details>
              </>
            )}
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Select a message to view details.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function UsageCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}
