'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Hourglass } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { IBlockedReason } from '@/types/message-pack';
import { useV2Session } from '@/v2/runtime/session-context';
import { userLimitsQuery } from './limits';
import { outOfMessagesView } from './out-of-messages';

/**
 * OutOfMessagesNotice — the ONE out-of-messages notice (v2 Stage 1, item 6).
 * A chat's error row, the home's composer, Usage and New radar all render it,
 * so a reader who runs out meets the same words and the same doors on every
 * surface: Upgrade plan (or Reactivate plan for a lapsed one), Buy message
 * pack, and when the messages come back. The rules are `out-of-messages.ts`.
 *
 * THE BLOCK, WHEREVER IT CAME FROM. A surface that has the server's block
 * (a refused send, `first_scan.block_reason`, the limits' `blocked_reason`)
 * passes it. A chat's error row may have only the words (a mid-stream
 * refusal carries no block object), so the notice then reads the account's
 * limits for the block and the reset time, and shows the words it was given
 * until they arrive.
 *
 * Gold, not red: running out is a door to more, not a failure.
 */
export function OutOfMessagesNotice({
  blocked,
  fallbackMessage,
  heading,
  leading,
  tight = false,
  className,
}: {
  blocked?: IBlockedReason | null;
  /** The words to show when no block object came with them. */
  fallbackMessage?: string | null;
  /** A surface's own title for the moment (New radar: the skipped first scan). */
  heading?: string;
  /** A surface's own way on, placed before the notice's doors (New radar: Go to radar). */
  leading?: ReactNode;
  /** The tighter form, for the chat's row and the composer. */
  tight?: boolean;
  className?: string;
}) {
  const { signedIn, role, userId } = useV2Session();
  const account = signedIn && role !== 'guest' && role !== 'bot';
  // Only when the surface has no block of its own: the limits name it, and
  // give the reset time the refusal's words did not.
  const limits = useQuery({
    ...userLimitsQuery({ viewerId: userId }),
    enabled: account && !blocked,
  });
  const ai = limits.data?.data?.ai_messages;
  const view = outOfMessagesView({
    blocked: blocked ?? ai?.blocked_reason ?? null,
    fallbackMessage,
    resetsAt: ai?.resets_at ?? null,
    resetMessage: ai?.reset_message ?? null,
  });

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5',
        tight ? 'px-3.5 py-3' : 'px-4 py-5',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary',
            tight ? 'size-8' : 'size-10',
          )}
        >
          <Hourglass className={tight ? 'size-4' : 'size-5'} />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{heading ?? view.heading}</p>
          {view.body ? <p className="max-w-md text-sm text-muted-foreground">{view.body}</p> : null}
          {view.reset ? <p className="max-w-md text-xs text-muted-foreground">{view.reset}</p> : null}
        </div>
      </div>
      {leading || view.actions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {leading}
          {view.actions.map((action) => (
            <Button
              key={action.label}
              asChild
              size="sm"
              variant={action.primary && !leading ? 'default' : 'outline'}
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
