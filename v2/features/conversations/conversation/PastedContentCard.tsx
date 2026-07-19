'use client';

import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

/**
 * PastedContentCard (v2 port of `components/chat/pasted-content-card.tsx`). A large
 * pasted block shown as a compact "PASTED" chip; click opens a scrollable dialog
 * with a Copy action. Byte-faithful to v1; used both read-only in the user message
 * row and (with `onRemove`) as a staging chip in the composer.
 */
interface PastedContentCardProps {
  content: string;
  onRemove?: () => void;
}

export function PastedContentCard({ content, onRemove }: PastedContentCardProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div
        className="w-40 shrink-0 cursor-pointer rounded-lg border bg-muted/50 p-2.5 transition-colors hover:bg-muted/80"
        onClick={() => setOpen(true)}
      >
        <p className="text-muted-foreground line-clamp-3 break-words text-[11px] leading-tight">
          {content.slice(0, 100)}...
        </p>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="rounded border px-1.5 py-0.5 text-[10px] font-medium">PASTED</span>
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remove pasted content"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pasted Content</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/30 p-4">
            <pre className="whitespace-pre-wrap break-words text-sm">{content}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
