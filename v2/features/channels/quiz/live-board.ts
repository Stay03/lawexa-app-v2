import type { QuizGameResults, QuizLeaderboard, QuizLeaderboardEntry } from '@/types/channel-quiz';

/**
 * A finished game's ranking in the shape of the quiz's own leaderboard, so
 * the live quiz's final scores are drawn by the solo board itself
 * (`v2/features/quiz/solo/board/FrontBoard.tsx`: the podium with its
 * animation, then the ranked rows), never by a look-alike (Arthur, f730f71c,
 * 11 November 2026).
 *
 * Every player in the game is ranked here (the results endpoint sends them
 * all), so the reader's own row is always one of the entries; `viewer` is
 * what the board needs to mark it and to say how they did. Points are the
 * game's score; there is no best of many attempts, so `achieved_at` is null.
 * Where a player studies is not in a game's results yet (Backend is adding
 * it); until then the board shows names alone, as it does for a visitor.
 */
export function liveGameBoard(results: QuizGameResults, viewerUuid: string | null): QuizLeaderboard {
  const entries: QuizLeaderboardEntry[] = results.ranking.map((row) => ({
    rank: row.rank,
    user: { uuid: row.user.uuid, name: row.user.name, avatar_url: row.user.avatar_url },
    points: row.score,
    correct_count: row.correct_count,
    question_count: row.answerable_count,
    achieved_at: null,
  }));
  const own = viewerUuid === null ? undefined : results.ranking.find((row) => row.user.uuid === viewerUuid);
  return {
    player_count: results.game.player_count,
    entries,
    viewer: own
      ? {
          rank: own.rank,
          points: own.score,
          players_behind: results.ranking.filter((row) => row.score < own.score).length,
          achieved_at: null,
          user: { uuid: own.user.uuid, name: own.user.name, avatar_url: own.user.avatar_url },
        }
      : null,
  };
}

/** The board's (i) for a game: one game's points, not a best of many attempts. */
export const LIVE_BOARD_RULES_NOTE =
  'Ranked by points in this game. Right answers score more the faster they come.';
