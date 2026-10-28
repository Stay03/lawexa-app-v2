import type { QuizLeaderboard } from '@/types/channel-quiz';
import { standingLine } from '../home-model';

/**
 * Where a finished run leaves the reader on the quiz's board, for the block
 * under "See your answers" (Arthur, 28 October 2026: "You're #4 of 23
 * players", the "better than" line, View leaderboard, and the podium moment
 * for a top-three finish).
 *
 * EVERY NUMBER IS THE SERVER'S. The rank, the player count and
 * `players_behind` come from `GET /channel-quizzes/{quiz}/leaderboard`, read
 * after the finish (the finish writes the board row at once, Backend); the
 * app never works a rank out.
 *
 * THE RANK IS THE BEST RUN. The board ranks each player by their best score,
 * so when this run scored less than the best the line says "Your best: #4",
 * and the podium moment is kept for a run that put them there.
 *
 * NO PLACE IS NOT AN ERROR. `viewer` is null when the reader wrote the quiz,
 * when their attempt began before its questions last changed, or when the
 * quiz is not public; each reads as "not ranked".
 */
export type FinishPosition =
  | { kind: 'unranked'; line: string }
  | {
      kind: 'ranked';
      /** "You're #4 of 23 players" or "Your best: #4 of 23 players". */
      line: string;
      /** The "better than" line, or `null` when there is nothing to compare. */
      standing: string | null;
      /** 1, 2 or 3 when this run put the reader on the podium, else `null`. */
      podiumPlace: 1 | 2 | 3 | null;
    };

const NUMBER = new Intl.NumberFormat('en-US');

export const UNRANKED_LINE = 'This run isn’t ranked on the leaderboard.';
export const PRIVATE_UNRANKED_LINE = 'Only public quizzes have a leaderboard.';

export function finishPosition(
  board: Pick<QuizLeaderboard, 'player_count' | 'viewer'>,
  runPoints: number,
  { publicQuiz = true }: { publicQuiz?: boolean } = {},
): FinishPosition {
  const viewer = board.viewer;
  if (!viewer) return { kind: 'unranked', line: publicQuiz ? UNRANKED_LINE : PRIVATE_UNRANKED_LINE };

  // A count read before it caught up with the reader's row never says "#4 of 3".
  const count = Math.max(board.player_count, viewer.rank);
  const best = viewer.points > runPoints;
  const place = `#${NUMBER.format(viewer.rank)}`;
  const of = count > 1 ? ` of ${NUMBER.format(count)} players` : '';
  const line = best ? `Your best: ${place}${of}` : `You’re ${place}${of}`;
  const podiumPlace = !best && viewer.rank >= 1 && viewer.rank <= 3 ? (viewer.rank as 1 | 2 | 3) : null;

  return {
    kind: 'ranked',
    line,
    standing: standingLine(viewer.players_behind, count, viewer.rank),
    podiumPlace,
  };
}
