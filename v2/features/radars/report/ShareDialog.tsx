'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Globe, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { radarsApi } from '@/lib/api/radars';
import { extractApiError } from '@/lib/utils/api-error';
import { useShareUrl } from '@/v2/features/sharing/useShareUrl';
import type { RadarScanDetail } from '@/types/radar';
import { radarsQueries } from '../queries';

/**
 * ShareDialog — the owner's publish/unpublish control for a completed report.
 *
 * Publishing serves the SAME URL to everyone: signed-in users through the
 * authed endpoint's trimmed shape, everyone else through the public endpoint.
 * `scan.is_private` stays the single source of truth (the mutation
 * invalidates the whole per-radar scan tree, which refreshes the detail, the
 * list rows' Shared badge, and the public entry together) — no local copy.
 *
 * v1 fixes carried in: the copied-state timeout is CLEANED UP on unmount (v1
 * leaked it), and the 422 "cannot be shared yet" answer keeps its specific
 * copy rather than a generic failure.
 */
export function ShareDialog({
  radarUuid,
  scan,
}: {
  radarUuid: string;
  scan: RadarScanDetail;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  // The app origin, client-only, behind a lazy initializer. The dialog only
  // opens on interaction, so the empty SSR value is never visible.
  const [origin] = useState(() =>
    typeof window === 'undefined' ? '' : window.location.origin,
  );

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    },
    [],
  );

  const invalidates = [radarsQueries.scans(radarUuid)];
  const publish = useMutation({
    mutationFn: () => radarsApi.publishScan(radarUuid, scan.uuid),
    meta: { invalidates, silentError: true },
    onSuccess: () => toast.success('Report is now shareable'),
    onError: (error) => {
      toast.error(
        extractApiError(error).status === 422
          ? 'This scan cannot be shared yet.'
          : 'Failed to update visibility',
      );
    },
  });
  const unpublish = useMutation({
    mutationFn: () => radarsApi.unpublishScan(radarUuid, scan.uuid),
    meta: { invalidates },
    onSuccess: () => toast.success('Report is now private'),
  });

  const isPrivate = scan.is_private;
  const isPending = publish.isPending || unpublish.isPending;
  /* An ambassador's code rides the link they copy, so a signup from it credits
     them. Everybody else copies exactly what they copied before. */
  const shareUrl = useShareUrl();
  const shareableLink = origin
    ? shareUrl(`${origin}/radars/${radarUuid}/scans/${scan.uuid}`)
    : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {isPrivate ? (
            <Lock aria-hidden className="size-4" />
          ) : (
            <Globe aria-hidden className="size-4" />
          )}
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share report</DialogTitle>
          <DialogDescription>
            Publishing lets anyone with the link read this report. Check the
            content before sharing.
          </DialogDescription>
        </DialogHeader>

        {/* Two toggle buttons, not a fake radiogroup: announcing radios
            without arrow-key roving would promise keyboarding the control
            does not have. `aria-pressed` says exactly what these are. */}
        <div className="space-y-2" role="group" aria-label="Report visibility">
          <VisibilityOption
            icon={Lock}
            title="Private"
            description="Only you can view"
            selected={isPrivate}
            busy={isPending && !isPrivate}
            onSelect={() => {
              if (!isPrivate) unpublish.mutate();
            }}
          />
          <VisibilityOption
            icon={Globe}
            title="Public access"
            description="Anyone with the link can view"
            selected={!isPrivate}
            busy={isPending && isPrivate}
            onSelect={() => {
              if (isPrivate) publish.mutate();
            }}
          />
        </div>

        {!isPrivate ? (
          <div className="space-y-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareableLink}
                aria-label="Shareable link"
                className="flex-1 text-sm"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button onClick={() => void copyLink()} className="shrink-0">
                {copied ? (
                  <>
                    <Check aria-hidden className="size-4" />
                    Copied
                  </>
                ) : (
                  'Copy link'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Viewed {scan.views_count}{' '}
              {scan.views_count === 1 ? 'time' : 'times'}
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function VisibilityOption({
  icon: Icon,
  title,
  description,
  selected,
  busy,
  onSelect,
}: {
  icon: typeof Lock;
  title: string;
  description: string;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      disabled={busy}
      className={cn(
        'v2-interactive flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:bg-muted/50',
      )}
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"
      >
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="block text-sm text-muted-foreground">
          {description}
        </span>
      </span>
      {selected ? (
        <Check aria-hidden className="size-5 shrink-0 text-primary" />
      ) : busy ? (
        <Loader2
          aria-hidden
          className="size-5 shrink-0 animate-spin text-muted-foreground"
        />
      ) : null}
    </button>
  );
}
