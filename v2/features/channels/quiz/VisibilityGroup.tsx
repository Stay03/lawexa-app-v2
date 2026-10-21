'use client';

import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { extractApiError } from '@/lib/utils/api-error';
import type { ChannelQuiz } from '@/types/channel-quiz';
import { useSetQuizVisibility } from './mutations';
import {
  isQuizVisibility,
  PUBLIC_NEEDS_VERIFIED_AUTHOR,
  quizHasRoom,
  VISIBILITY_FOOTNOTE,
  visibilityChoicesFor,
} from './model';

/**
 * VisibilityGroup — WHO CAN FIND THIS QUIZ: the owner's switch inside a row's
 * menu, and the sentences that keep it honest. One component for the channel
 * sheet's row and the library page's row, so the four choices cannot be
 * worded two ways.
 *
 * The copy does the work `visibility` actually does and no more: it changes
 * whose LISTS the quiz appears on, and (for `link` and `public`) who may open
 * it by its address. It does not retract a game, hide a lobby, withdraw a
 * result or unpost a card, and the footnote says so in the same breath as the
 * choice rather than in a help article nobody opens.
 *
 * `shared` is offered only where a room is in the picture (`quizHasRoom`): a
 * quiz written straight into a library has no room to be shared in.
 *
 * ── "EVERYONE" IS FOR VERIFIED AUTHORS (2026-10-21) ────────────────────────
 * The choice is drawn for everyone and DISABLED, with the reason under it, for
 * an author the session says is not verified — a hidden choice would leave the
 * reader wondering why their quiz cannot be found, and a live one would only
 * be refused. The session's flag is a courtesy: when the server still answers
 * `403` (a stale snapshot), the same sentence is handed back through
 * `onRefused` and the row says it in place. The write is optimistic with a
 * real rollback (`useSetQuizVisibility`), so the row snaps back to what the
 * server still says.
 */
export function VisibilityGroup({
  quiz,
  canPublish,
  onRefused,
}: {
  quiz: ChannelQuiz;
  /** `canPublishPublicly(session)` — whether "Everyone" is live. */
  canPublish: boolean;
  /** The row's one line for a refusal; `null` clears the previous one. */
  onRefused: (message: string | null) => void;
}) {
  const setVisibility = useSetQuizVisibility(quiz.uuid);
  const choices = visibilityChoicesFor(quizHasRoom(quiz));

  return (
    <>
      <DropdownMenuLabel>Who can find it</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={quiz.visibility}
        onValueChange={(value) => {
          if (!isQuizVisibility(value)) return;
          // A fresh choice clears the last refusal: the reader must never read
          // last try's sentence under this try's row.
          onRefused(null);
          setVisibility.mutate(value, {
            onError: (error) => {
              const { status, message } = extractApiError(error);
              onRefused(
                status === 403 && value === 'public'
                  ? PUBLIC_NEEDS_VERIFIED_AUTHOR
                  : message,
              );
            },
          });
        }}
      >
        {choices.map((choice) => {
          const locked = choice.needsVerifiedAuthor && !canPublish;
          return (
            <DropdownMenuRadioItem
              key={choice.id}
              value={choice.id}
              disabled={locked}
              className="items-start"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm text-foreground">{choice.label}</span>
                <span className="text-xs text-muted-foreground">
                  {locked ? PUBLIC_NEEDS_VERIFIED_AUTHOR : choice.hint}
                </span>
              </span>
            </DropdownMenuRadioItem>
          );
        })}
      </DropdownMenuRadioGroup>
      <p className="px-3 pt-1 pb-2 text-xs text-muted-foreground/80">
        {VISIBILITY_FOOTNOTE}
      </p>
    </>
  );
}
