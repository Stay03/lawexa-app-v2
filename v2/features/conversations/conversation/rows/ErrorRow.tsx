'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ErrorMessage } from '@/types/chat';
import { OutOfMessagesNotice } from '@/v2/features/subscription/OutOfMessagesNotice';

/**
 * ErrorRow — v2-native render of a backend ErrorMessage (§C KEEP: error banners +
 * retry). Running out of messages is the shared out-of-messages notice
 * (`OutOfMessagesNotice`, v2 Stage 1, item 6): Upgrade or Reactivate, Buy message
 * pack, and when the messages come back, from the refused send's own block, or
 * from the account's limits when the refusal came mid-stream with words only.
 * An answer that failed after it had started (`failedAnswer`) is a quiet grey
 * row in the answer's place: its streamed text was withdrawn and the turn is
 * not charged (Stay, 27 October 2026), so it says exactly that, never the
 * server's error text, and offers Try again.
 * Every other error is a destructive banner with an inline Retry when the server
 * marks it retryable.
 */

/** What a failed answer's row says (Stay, 27 October 2026). */
export const FAILED_ANSWER_LINE = "Lawexa couldn't finish this answer.";
export const FAILED_ANSWER_FREE = "It wasn't counted against your messages.";

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
    return <OutOfMessagesNotice tight blocked={message.blocked} fallbackMessage={message.content} />;
  }

  if (message.failedAnswer) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      >
        <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex-1">
          <p className="font-medium text-foreground">{FAILED_ANSWER_LINE}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{FAILED_ANSWER_FREE}</p>
        </div>
        {message.retryable && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1.5 text-xs"
            onClick={onRetry}
            disabled={isStreaming}
          >
            <RotateCcw aria-hidden className="h-3 w-3" />
            Try again
          </Button>
        )}
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
