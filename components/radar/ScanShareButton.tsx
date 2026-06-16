'use client';

import { useState } from 'react';
import { Globe, Lock, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
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
import { usePublishScan, useUnpublishScan } from '@/lib/hooks/useRadars';
import { extractApiError } from '@/lib/utils/api-error';
import { cn } from '@/lib/utils';
import type { RadarScanDetail } from '@/types/radar';

interface ScanShareButtonProps {
  radarUuid: string;
  scan: RadarScanDetail;
}

/**
 * Owner-only share control for a completed scan report. Publish makes the
 * report readable by other signed-in users and logged-out visitors at the same
 * URL; unpublish makes it private again. `scan.is_private` is the source of
 * truth (the page refetches on toggle), so we don't keep a local copy.
 */
function ScanShareButton({ radarUuid, scan }: ScanShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const publish = usePublishScan();
  const unpublish = useUnpublishScan();

  const isPrivate = scan.is_private;
  const isPending = publish.isPending || unpublish.isPending;

  const shareableLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/radars/${radarUuid}/scans/${scan.uuid}`
      : '';

  const handleSetPublic = async () => {
    if (!isPrivate) return;
    try {
      await publish.mutateAsync({ radarUuid, scanUuid: scan.uuid });
      toast.success('Report is now shareable');
    } catch (err) {
      const apiError = extractApiError(err);
      toast.error(
        apiError.status === 422
          ? 'This scan cannot be shared yet.'
          : 'Failed to update visibility'
      );
    }
  };

  const handleSetPrivate = async () => {
    if (isPrivate) return;
    try {
      await unpublish.mutateAsync({ radarUuid, scanUuid: scan.uuid });
      toast.success('Report is now private');
    } catch {
      toast.error('Failed to update visibility');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
          <span>Share</span>
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

        <div className="space-y-2">
          {/* Private */}
          <button
            onClick={handleSetPrivate}
            disabled={isPending}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors',
              isPrivate ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Private</p>
              <p className="text-sm text-muted-foreground">Only you can view</p>
            </div>
            {isPrivate && <Check className="h-5 w-5 text-primary" />}
            {isPending && !isPrivate && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </button>

          {/* Public */}
          <button
            onClick={handleSetPublic}
            disabled={isPending}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors',
              !isPrivate ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Public access</p>
              <p className="text-sm text-muted-foreground">Anyone with the link can view</p>
            </div>
            {!isPrivate && <Check className="h-5 w-5 text-primary" />}
            {isPending && isPrivate && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Link + view count — only when public */}
        {!isPrivate && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input readOnly value={shareableLink} className="flex-1 text-sm" />
              <Button onClick={handleCopyLink} className="shrink-0">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Copied
                  </>
                ) : (
                  'Copy link'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Viewed {scan.views_count} {scan.views_count === 1 ? 'time' : 'times'}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { ScanShareButton };
