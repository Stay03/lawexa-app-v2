'use client';

import { Check, Loader2, RotateCcw, Share2 } from 'lucide-react';

import { useShareAction } from '@/v2/features/sharing/use-share-action';
import { quizFrontHref } from '../model';
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
 * answers 404.
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
  retaking,
  onRetake,
}: {
  quizUuid: string;
  quizTitle: string;
  /** The sentence the share sheet gets beside the link. */
  challenge: string;
  /** A link or public quiz — the only ones a shared link can open. */
  shareable: boolean;
  retaking: boolean;
  onRetake: () => void;
}) {
  const share = useShareAction({
    path: quizFrontHref(quizUuid),
    title: quizTitle,
    text: challenge,
  });

  return (
    <div className="sticky bottom-0 z-10 -mx-4 -mb-16 mt-auto bg-background/85 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="flex flex-wrap gap-2.5">
        <RaisedButton className="min-w-0 flex-1 basis-40" onClick={onRetake} disabled={retaking}>
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
            className="min-w-0 flex-1 basis-40"
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
      </div>
    </div>
  );
}
