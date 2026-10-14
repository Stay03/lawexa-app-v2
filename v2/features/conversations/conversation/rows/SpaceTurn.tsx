'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ConversationAuthor } from '@/types/chat';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
import { clockTime } from '../day-label';
import { memberStyle } from '../member-colour';
import { UNNAMED_ASKER, type TurnSide } from '../space-turn';

/**
 * SpaceTurn — one question in a space chat, laid out the way Arthur drew it
 * (14 October 2026: "leave message sent from the user on the right and move
 * others to left. A message time stamp is needed").
 *
 *  - The reader's own question on the RIGHT, as a bubble, with "You · 10:36 AM"
 *    under it.
 *  - Everyone else's on the LEFT: their initials crest, their name and the time
 *    on one line, and the question under the name in their colour.
 *
 * Which side is decided by {@link TurnSide} (space-turn.ts `turnSide`): mine
 * only by the reader's own id, or a row this client drew itself. A withheld
 * writer (`null`) is never mine: it goes left as "Someone", in the plain grey.
 * The colours are the member colours (member-colour.ts), set on the row so the
 * crest, the name and the bubble read as one person.
 */
export function SpaceTurn({
  side,
  author,
  time,
  colourIndex,
  children,
}: {
  side: TurnSide;
  /** The asker, as the server named them; null when withheld. */
  author: ConversationAuthor | null;
  time: Date;
  colourIndex: number | null;
  children: ReactNode;
}) {
  const style = colourIndex === null ? undefined : memberStyle(colourIndex);
  const at = clockTime(time);

  if (side === 'mine') {
    return (
      <div className="flex flex-col items-end" style={style}>
        {children}
        <div className="text-muted-foreground mt-1.5 text-xs tabular-nums">
          <span aria-hidden>You · {at}</span>
          <span className="sr-only">Asked by you at {at}</span>
        </div>
      </div>
    );
  }

  const name = author?.name ?? UNNAMED_ASKER;
  const tinted = colourIndex !== null;
  return (
    <div className="flex min-w-0 items-start gap-2.5" style={style}>
      <MemberAvatar
        user={author}
        className={cn(
          'mt-0.5 shrink-0',
          // The crest in the asker's colour, as the bubble and the name.
          tinted &&
            '[&_[data-slot=avatar-fallback]]:bg-[var(--member-bg)] [&_[data-slot=avatar-fallback]]:text-[var(--member-ink)] dark:[&_[data-slot=avatar-fallback]]:bg-[var(--member-bg-dark)] dark:[&_[data-slot=avatar-fallback]]:text-[var(--member-ink-dark)]',
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <div className="mb-1 flex min-w-0 max-w-full items-baseline gap-2">
          <span
            aria-hidden
            className={cn(
              'truncate text-sm font-medium',
              tinted ? 'text-[var(--member-ink)] dark:text-[var(--member-ink-dark)]' : 'text-foreground',
            )}
          >
            {name}
          </span>
          <span aria-hidden className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {at}
          </span>
          <span className="sr-only">
            Asked by {name} at {at}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
