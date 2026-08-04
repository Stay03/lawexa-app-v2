import { Trophy } from 'lucide-react';

import type { Message } from '@/types/collab';
import { RelativeTime } from '../ui/RelativeTime';

/**
 * QuizCardPreview — a quiz system card as it looks to someone who cannot play.
 *
 * WHY IT IS A SEPARATE CARD AND NOT THE REAL ONE WITH ITS BUTTON HIDDEN. The
 * live card is an ACTIVE surface: it asks the server about the game behind the
 * message so it can show a lobby, a player count or a result. A space member
 * previewing a `space_public` channel may read the transcript but may not join
 * a quiz, and the quiz endpoints are not on the open list — so the honest
 * render is one that makes NO REQUEST at all. Dropping the message instead was
 * the other option and it is worse: a hole in the transcript is a lie about
 * what happened in the room.
 *
 * So this keeps the record and drops the verb. The card says a quiz happened,
 * carries Lawexa's own sentence for it (`message.content` — the same words
 * every member saw), and stops there. The way in is the dock at the foot of
 * the feed, which is the only join this screen offers a previewer.
 */
export function QuizCardPreview({ message }: { message: Message }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border bg-muted/30 px-3.5 py-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <Trophy className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground">{message.content}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <RelativeTime iso={message.created_at} />
            <span aria-hidden>·</span>
            <span>Join the channel to take part</span>
          </p>
        </div>
      </div>
    </div>
  );
}
