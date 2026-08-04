import { Trophy, Zap } from 'lucide-react';

import { formatFullTimestamp, formatMessageTime } from '@/lib/utils/collab';
import type { Message } from '@/types/collab';

/**
 * QuizGameCard — the designed QUIET card for the two quiz system messages
 * (`metadata.type: 'quiz_game_live' | 'quiz_game_finished'`; digest §E).
 * These already occur in prod feeds, so W2 must render them properly — but
 * render-ONLY: W6 wires Join/Results off `metadata.game_uuid`/`quiz_uuid`,
 * and until an action can actually work it does not exist (the no-dead-
 * buttons rule in the W2 brief). The card therefore states what happened —
 * the backend-authored `content` line — under a typed kicker, and nothing
 * else. Unknown FUTURE `metadata.type` values never reach this component:
 * the feed model's fallback renders them as plain text (contractual).
 */
export function QuizGameCard({ message }: { message: Message }) {
  const finished = message.metadata.type === 'quiz_game_finished';

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          {finished ? <Trophy className="size-4" /> : <Zap className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {finished ? 'Quiz finished' : 'Live quiz'}
          </p>
          <p className="mt-0.5 text-sm break-words text-foreground">
            {message.content}
          </p>
        </div>
        <time
          dateTime={message.created_at}
          title={formatFullTimestamp(message.created_at)}
          className="shrink-0 pt-0.5 text-xs text-muted-foreground"
        >
          {formatMessageTime(message.created_at)}
        </time>
      </div>
    </div>
  );
}
