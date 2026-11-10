'use client';

import Link from 'next/link';
import { Check, Compass, Loader2, Lock, RotateCcw, Share2 } from 'lucide-react';

import type { ChannelQuizVisibility } from '@/types/channel-quiz';
import { EXPLORE_HREF } from '../model';
import { RaisedButton } from '../ui';
import { useChallengeFriend } from '../use-challenge-friend';

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
 * ── ONE TAP, EVEN ON A QUIZ ONLY ITS AUTHOR CAN OPEN (Arthur, 10 November) ─
 * `useChallengeFriend` decides and does it, for this bar and the quiz's front
 * alike: it shares a quiz a link opens, and on the author's own quiz no link
 * opens yet it also switches it to "Anyone with the link" in the same tap.
 * Should that switch fail, a line here says the link will not open for a
 * friend yet.
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
  attemptUuid,
  quizTitle,
  challenge,
  visibility,
  isMine,
  retaking,
  onRetake,
}: {
  quizUuid: string;
  /** This finished attempt: the challenge link carries it, so the friend sees the score to beat. */
  attemptUuid: string;
  quizTitle: string;
  /** The sentence the share sheet gets beside the link. */
  challenge: string;
  /** Who can open the quiz; null while its detail loads. */
  visibility: ChannelQuizVisibility | null;
  /** The reader wrote it: only they may open it to the link. */
  isMine: boolean;
  retaking: boolean;
  onRetake: () => void;
}) {
  const friend = useChallengeFriend({
    quizUuid,
    fromAttempt: attemptUuid,
    title: quizTitle,
    text: challenge,
    visibility,
    isMine,
  });

  return (
    // Each button keeps its label's width; two that do not fit side by side
    // stack, each across the row, rather than squeeze (Arthur, 28 October 2026).
    // `data-results-bar`: the podium moment waits until it is clear of this bar.
    <div data-results-bar="" className="sticky bottom-0 z-10 -mx-4 -mb-16 mt-auto bg-background/85 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="flex flex-wrap gap-2.5">
        <RaisedButton className="min-w-fit flex-1 basis-40 whitespace-nowrap" onClick={onRetake} disabled={retaking}>
          {retaking ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <RotateCcw aria-hidden className="size-4" />
          )}
          Take it again
        </RaisedButton>
        {friend.available && (
          <RaisedButton
            tone="quiet"
            className="min-w-fit flex-1 basis-40 whitespace-nowrap"
            onClick={friend.challenge}
          >
            {friend.copied ? (
              <Check aria-hidden className="size-4 text-primary" />
            ) : (
              <Share2 aria-hidden className="size-4" />
            )}
            <span aria-live="polite">{friend.copied ? 'Link copied' : 'Challenge a friend'}</span>
          </RaisedButton>
        )}
        <RaisedButton tone="quiet" className="min-w-fit flex-1 basis-40 whitespace-nowrap" asChild>
          <Link href={EXPLORE_HREF}>
            <Compass aria-hidden className="size-4" />
            Other Quizzes
          </Link>
        </RaisedButton>
      </div>
      {friend.openFailed ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2.5 rounded-2xl border border-border/60 bg-secondary/30 px-3.5 py-3 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Your quiz couldn&rsquo;t be opened to anyone with the link, so the link won&rsquo;t open for a friend yet.
            Tap Challenge a friend to try again.
          </span>
        </p>
      ) : null}
    </div>
  );
}
