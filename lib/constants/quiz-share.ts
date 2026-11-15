/**
 * The public quiz-results share link — its address, and the one sentence that
 * has to travel with it.
 *
 * IT LIVES HERE BECAUSE IT IS WRITTEN AND READ ON OPPOSITE SIDES OF A WALL.
 * The affordance that hands the link out is a v2 surface (the result card's
 * Share, `v2/features/channels/quiz/ResultCardShare.tsx`); the page that serves it is a
 * plain public route (`app/quiz-results/[gameUuid]`), deliberately OUTSIDE the
 * v2 tree so a stranger with no opt-in cookie can open it. Those two may not
 * import each other, so a second copy of the path would be a shared link that
 * keeps working right up until someone renames a folder. `lib/constants` is
 * the shared layer both are allowed to read.
 */

/**
 * Where a finished game's public result lives.
 *
 * NOT in `v2/routes.manifest.ts`, and that omission is the whole design: a path
 * in the manifest is only served from the v2 tree when the reader carries the
 * `lawexa-ui=v2` cookie, and a shared link is opened by people who have never
 * heard of this app. Left out of the manifest, the proxy ignores it and one
 * page answers for everyone.
 */
export function publicQuizResultsPath(gameUuid: string): string {
  return `/quiz-results/${encodeURIComponent(gameUuid)}`;
}

/**
 * Where the reader finished, which is the only thing that decides what the card
 * should say to them.
 *
 * `leader` is the rank-1 player's display name, and it is nullable on purpose:
 * a ranking can arrive empty (nobody answered a single question before the host
 * ended it), and a name we do not have must never be printed as "undefined".
 */
export type QuizShareStanding =
  | { readonly outcome: 'won' }
  /** The only player: there is no place to claim (Arthur, 0f517a68), only a score to beat. */
  | { readonly outcome: 'solo' }
  | { readonly outcome: 'played'; readonly leader: string | null }
  | { readonly outcome: 'watched'; readonly leader: string | null };

/**
 * The card's two lines — a claim, then the ask.
 *
 * ONE JOB: get the reader to hand the link over. The winner is told they are
 * the target; a player who lost is pointed at the person who beat them, which
 * is the same motivation from the other side; someone who only watched is given
 * the scoreboard and a reason to start the next round. The winner's words are
 * the owner's own, kept verbatim.
 *
 * A pure function of the standing, so the copy is testable and lives beside the
 * notice it sits above rather than inside a component's JSX.
 */
export function quizShareInvite(standing: QuizShareStanding): {
  headline: string;
  ask: string;
} {
  if (standing.outcome === 'solo') {
    return {
      headline: 'Can anyone beat your score?',
      ask: 'Share this challenge with your study group and find out.',
    };
  }

  if (standing.outcome === 'won') {
    return {
      headline: "You're the one to beat.",
      ask: 'Share this challenge with your study group and see who can take your spot.',
    };
  }

  if (standing.outcome === 'played') {
    return standing.leader
      ? {
          headline: `${standing.leader} is the one to beat.`,
          ask: 'Share this challenge with your study group and see who can knock them off the top.',
        }
      : {
          headline: 'Think your study group can do better?',
          ask: 'Share this challenge and find out.',
        };
  }

  return standing.leader
    ? {
        headline: `${standing.leader} took this one.`,
        ask: 'Share the scores with your study group and start the next round.',
      }
    : {
        headline: 'The scores are in.',
        ask: 'Share them with your study group and start the next round.',
      };
}
