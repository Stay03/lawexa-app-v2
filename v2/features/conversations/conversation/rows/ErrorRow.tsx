'use client';

import Link from 'next/link';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ErrorMessage } from '@/types/chat';

/**
 * ErrorRow — v2-native render of a backend ErrorMessage (§C KEEP: error banners +
 * retry). A message-cap / plan-gate exhaustion gets its own gold-tinted banner with
 * the upgrade path (an invitation, not a failure); every other error is a
 * destructive banner with an inline Retry when the server marks it retryable.
 *
 * NOTE: v1's plan-aware `MessageBlockBanner` also showed the plan tier + reset time
 * pulled from the `useUserLimits` query (a v1 hook, boundary-blocked). Those extras
 * are deferred until a v2 limits query exists; the server's own message + the
 * upgrade CTA carry the essential UX.
 */
const EXHAUSTED_CODES = new Set([
  'MESSAGES_EXHAUSTED',
  'AI_MESSAGES_EXHAUSTED',
  'ai_messages_exhausted',
]);

export function ErrorRow({
  message,
  onRetry,
  isStreaming,
}: {
  message: ErrorMessage;
  onRetry: () => void;
  isStreaming: boolean;
}) {
  if (EXHAUSTED_CODES.has(message.errorCode)) {
    return (
      <div className="border-primary/40 bg-primary/10 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm">
        <AlertCircle className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="text-foreground min-w-0 flex-1">{message.content}</span>
        <Link
          href="/upgrade"
          className="text-primary shrink-0 text-sm font-medium hover:underline"
        >
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div className="border-destructive/30 bg-destructive/10 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm">
      <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">
        <p className="text-destructive font-medium">{message.content}</p>
        {message.retryable && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            You can try sending your message again.
          </p>
        )}
      </div>
      {message.retryable && (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive h-7 shrink-0 gap-1.5 text-xs"
          onClick={onRetry}
          disabled={isStreaming}
        >
          <RotateCcw className="h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  );
}
