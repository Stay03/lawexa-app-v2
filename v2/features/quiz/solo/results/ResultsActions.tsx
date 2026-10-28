'use client';

import Link from 'next/link';
import { Check, Compass, Loader2, Lock, RotateCcw, Share2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useShareAction } from '@/v2/features/sharing/use-share-action';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { EXPLORE_HREF, quizFrontHref } from '../model';
import { RaisedButton } from '../ui';

/**
 * ResultsActions — the two things worth doing next, at the bottom of the
 * results: Take it again (a fresh attempt, the way this one was taken, into
 * the player) and Challenge a friend.
 *
 * ── CHALLENGE A FRIEND IS THE QUIZ'S LINK WITH A SENTENCE ──────────────────
 * What travels is the quiz for somebody else to take, so the link is the
 * quiz's own front, and the sentence beside it is the score and the ask
 * (`challengeText`: "Banner scored 4,858 points on … Can you beat me?"),
 * through the one share behaviour every share in v2 uses: the device's
 * sheet where there is one, the link alone to the clipboard where there is
 * not, and the button says "Link copied" for two seconds when it did. The
 * share IMAGE the design draws (`share.html`) needs a public read of the
 * attempt that the server does not offer yet; until it does, the sentence
 * carries the card's words.
 *
 * ── ONLY WHERE A LINK CAN OPEN THE QUIZ ────────────────────────────────────
 * The caller reads the quiz's visibility and withholds Challenge for a
 * private or channel-only quiz, rather than handing out an address that
 * answers 404. On an "Only you" quiz a quiet line takes its place and says
 * why, with the way to change it (Stay, 23 October 2026, picture 7): only
 * its author can take a private quiz, so the reader here is the author, and
 * the quiz's own page is where who can take it is set.
 *
 * ── OTHER QUIZZES, THE THIRD BUTTON (Arthur, 28 October 2026: "do B") ──────
 * "Take it again" replays this quiz, "Challenge a friend" shares it, and
 * "Other Quizzes" opens Explore Quizzes for a different one, at the same
 * size as the other two. Three that do not fit in a row wrap like the two
 * did, each at its label's width, so a phone stacks them.
 *
 * ── AT THE BOTTOM, AND IT STAYS THERE ──────────────────────────────────────
 * `mt-auto` puts the row on the bottom edge of a short page; `sticky
 * bottom-0` keeps it in reach once the review above is open and long, over
 * the same see-through plate the player's header uses.
 */
export function ResultsActions({
  quizUuid,
  quizTitle,
  challenge,
  shareable,
  privateQuiz,
  retaking,
  onRetake,
}: {
  quizUuid: string;
  quizTitle: string;
  /** The sentence the share sheet gets beside the link. */
  challenge: string;
  /** A link or public quiz — the only ones a shared link can open. */
  shareable: boolean;
  /** An "Only you" quiz: say why there is no Challenge. */
  privateQuiz: boolean;
  retaking: boolean;
  onRetake: () => void;
}) {
  const share = useShareAction({
    path: quizFrontHref(quizUuid),
    title: quizTitle,
    text: challenge,
  });

  return (
    // Each button keeps its label's width; two that do not fit side by side
    // stack, each across the row, rather than squeeze (Arthur, 28 October 2026).
    <div className="sticky bottom-0 z-10 -mx-4 -mb-16 mt-auto bg-background/85 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="flex flex-wrap gap-2.5">
        <RaisedButton className="min-w-fit flex-1 basis-40 whitespace-nowrap" onClick={onRetake} disabled={retaking}>
          {retaking ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <RotateCcw aria-hidden className="size-4" />
          )}
          Take it again
        </RaisedButton>
        {shareable && (
          <RaisedButton
            tone="quiet"
            className="min-w-fit flex-1 basis-40 whitespace-nowrap"
            onClick={() => void share.share()}
          >
            {share.copied ? (
              <Check aria-hidden className="size-4 text-primary" />
            ) : (
              <Share2 aria-hidden className="size-4" />
            )}
            <span aria-live="polite">{share.copied ? 'Link copied' : 'Challenge a friend'}</span>
          </RaisedButton>
        )}
        <RaisedButton tone="quiet" className="min-w-fit flex-1 basis-40 whitespace-nowrap" asChild>
          <Link href={EXPLORE_HREF}>
            <Compass aria-hidden className="size-4" />
            Other Quizzes
          </Link>
        </RaisedButton>
      </div>
      {privateQuiz && !shareable ? (
        <p className="mt-3 flex items-start gap-2.5 rounded-2xl border border-border/60 bg-secondary/30 px-3.5 py-3 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Only you can take this quiz.{' '}
            <Link
              href={quizFrontHref(quizUuid)}
              className={cn('rounded-sm font-semibold text-primary underline-offset-2 hover:underline', FOCUS_RING)}
            >
              Change who can take it
            </Link>{' '}
            to challenge a friend.
          </span>
        </p>
      ) : null}
    </div>
  );
}
