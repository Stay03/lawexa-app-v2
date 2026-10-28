import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { QuizLeaderboard } from '@/types/channel-quiz';
import { isViewerEntry } from './home-model';
import { finishPosition, PRIVATE_UNRANKED_LINE, UNRANKED_LINE } from './results/position-model';

/* The reader's place under "See your answers" (Arthur, 28 October 2026): the
 * position line, the "better than" line, View leaderboard, and the podium
 * moment for a top-three finish, on the leaderboard Backend sends after the
 * finish (Techlead's mocked boards, 28 October 2026). Pure rules first, then
 * the wiring, pinned by source. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const board = (
  playerCount: number,
  viewer: { rank: number; players_behind?: number; points: number } | null,
): Pick<QuizLeaderboard, 'player_count' | 'viewer'> => ({
  player_count: playerCount,
  viewer: viewer ? { achieved_at: '2026-10-28T07:00:00Z', ...viewer } : null,
});

test('a first place of 16 is on the podium and top of the board', () => {
  assert.deepEqual(finishPosition(board(16, { rank: 1, players_behind: 15, points: 6801 }), 6801), {
    kind: 'ranked',
    line: 'You’re #1 of 16 players',
    standing: 'You’re top of the board.',
    podiumPlace: 1,
  });
});

test('second and third are on the podium too', () => {
  assert.equal(finishPosition(board(16, { rank: 2, players_behind: 14, points: 6000 }), 6000).kind, 'ranked');
  const second = finishPosition(board(16, { rank: 2, players_behind: 14, points: 6000 }), 6000);
  const third = finishPosition(board(3, { rank: 3, players_behind: 0, points: 900 }), 900);
  assert.equal(second.kind === 'ranked' && second.podiumPlace, 2);
  assert.equal(third.kind === 'ranked' && third.podiumPlace, 3);
  assert.equal(third.kind === 'ranked' && third.line, 'You’re #3 of 3 players');
  assert.equal(third.kind === 'ranked' && third.standing, 'Play again to climb the board.');
});

test('ranked outside the top three: the place and the share, no podium', () => {
  assert.deepEqual(finishPosition(board(16, { rank: 8, players_behind: 7, points: 3100 }), 3100), {
    kind: 'ranked',
    line: 'You’re #8 of 16 players',
    standing: 'You’re doing better than 47% of other players.',
    podiumPlace: null,
  });
  assert.deepEqual(finishPosition(board(16, { rank: 16, players_behind: 0, points: 120 }), 120), {
    kind: 'ranked',
    line: 'You’re #16 of 16 players',
    standing: 'Play again to climb the board.',
    podiumPlace: null,
  });
});

test('small boards: two players, one player, and two level at the top', () => {
  const two = finishPosition(board(2, { rank: 2, players_behind: 0, points: 500 }), 500);
  assert.equal(two.kind === 'ranked' && two.line, 'You’re #2 of 2 players');
  assert.equal(two.kind === 'ranked' && two.podiumPlace, 2);

  // One player: no "of 1 players", no percentage.
  assert.deepEqual(finishPosition(board(1, { rank: 1, players_behind: 0, points: 500 }), 500), {
    kind: 'ranked',
    line: 'You’re #1',
    standing: 'You’re the only player so far.',
    podiumPlace: 1,
  });

  // Tied at the top: both rank 1 of 2, and neither beats anyone.
  const tie = finishPosition(board(2, { rank: 1, players_behind: 0, points: 800 }), 800);
  assert.equal(tie.kind === 'ranked' && tie.line, 'You’re #1 of 2 players');
  assert.equal(tie.kind === 'ranked' && tie.standing, 'You’re level at the top of the board.');
});

test('no place is "not ranked", never an error', () => {
  // The quiz's author, an attempt begun before the questions changed, or a quiz off the public list.
  assert.deepEqual(finishPosition(board(16, null), 4000), { kind: 'unranked', line: UNRANKED_LINE });
  assert.deepEqual(finishPosition(board(0, null), 4000, { publicQuiz: false }), {
    kind: 'unranked',
    line: PRIVATE_UNRANKED_LINE,
  });
});

test('a run below the reader’s best says "Your best", and keeps the podium for a run that earned it', () => {
  assert.deepEqual(finishPosition(board(23, { rank: 2, players_behind: 21, points: 7000 }), 5200), {
    kind: 'ranked',
    line: 'Your best: #2 of 23 players',
    standing: 'You’re doing better than 95% of other players.',
    podiumPlace: null,
  });
});

test('an older server without players_behind shows the place but no percentage', () => {
  const position = finishPosition(board(16, { rank: 13, points: 900 }), 900);
  assert.equal(position.kind === 'ranked' && position.line, 'You’re #13 of 16 players');
  assert.equal(position.kind === 'ranked' && position.standing, null);
});

test('a player count behind the reader’s own rank never reads "#4 of 3"', () => {
  const position = finishPosition(board(3, { rank: 4, players_behind: 0, points: 10 }), 10);
  assert.equal(position.kind === 'ranked' && position.line, 'You’re #4 of 4 players');
});

test('the results screen puts the place between the answers and the button bar, read from the board', () => {
  const screen = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptResultsScreen.tsx');
  assert.match(
    screen,
    /<AnswersFold attemptUuid=\{attempt\.uuid\} questions=\{questions\} \/>\s*<FinishPosition\s*quizUuid=\{attempt\.quiz\.uuid\}\s*runPoints=\{score\.points\}/,
  );
  assert.ok(screen.indexOf('<FinishPosition') < screen.indexOf('<ResultsActions'));

  const block = read('v2', 'features', 'quiz', 'solo', 'results', 'FinishPosition.tsx');
  // The server's board, never a rank worked out here.
  assert.match(block, /useQuery\(soloQuizQueries\.leaderboard\(quizUuid, \{ viewerId \}\)\)/);
  assert.match(block, /const position = finishPosition\(board, runPoints/);
  // A board that fails to load leaves the space as it was.
  assert.match(block, /if \(boardQuery\.isError \|\| !boardQuery\.data\) return null;/);
  // View leaderboard opens the quiz page's own board.
  assert.match(block, /href=\{`\$\{quizFrontHref\(quizUuid\)\}#quiz-front-board`\}/);
  // The podium moment is the quiz page's podium, rising; only for a podium finish.
  assert.match(block, /position\.kind === 'ranked' && position\.podiumPlace \? \(\s*<PodiumMoment/);
  assert.match(block, /<Podium entries=\{entries\} isYou=\{isYou\} rising=\{playing\} \/>/);
});

test('the podium moment is skippable and still under reduced motion', () => {
  const block = read('v2', 'features', 'quiz', 'solo', 'results', 'FinishPosition.tsx');
  // Skip only while the reader's face is on the podium to climb; else it stands still.
  assert.match(block, /const onPodium = entries\.some\(isYou\);/);
  assert.match(block, /useState<MomentPhase>\(\(\) => \(!prefersReducedMotion\(\) && onPodium \? 'waiting' : 'still'\)\);/);
  // It rises only once it is on screen (below the fold on a phone), clear of the button bar.
  assert.match(block, /if \(seen\(\)\) setPhase\('playing'\);/);
  assert.match(block, /onClick=\{stop\}/);
  assert.match(block, /className=\{cn\('w-full', phase === 'waiting' && 'opacity-0', !playing && 'v2-solo-podium-still'\)\}/);

  const css = read('v2', 'features', 'quiz', 'solo', 'solo-quiz.css');
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  for (const name of ['.v2-solo-podium-step', '.v2-solo-podium-face', '.v2-solo-podium-climb']) {
    assert.ok(reduced.includes(name), `${name} is off under reduced motion`);
  }
  assert.match(css, /\.v2-solo-podium-still :is\(\.v2-solo-podium-step, \.v2-solo-podium-face, \.v2-solo-podium-climb\) \{\s*animation: none;/);
  // About two seconds: the climb starts at 1s and lasts 0.9s.
  assert.match(css, /animation: v2-solo-podium-climb 900ms cubic-bezier\(0\.34, 1\.3, 0\.64, 1\) 1000ms both;/);
});

test('a finish refreshes the quiz’s board, so the results read the new place', () => {
  const mutations = read('v2', 'features', 'quiz', 'solo', 'mutations.ts');
  assert.match(
    mutations,
    /void queryClient\.invalidateQueries\(\{ queryKey: soloQuizQueries\.leaderboardOf\(response\.data\.quiz\.uuid\) \}\);/,
  );
});

test('"you" is the reader by their account, so a tie never marks two players', () => {
  const row = (uuid: string, rank: number, points: number) => ({ rank, points, user: { uuid, name: `TEST DATA ${uuid}` } });
  const viewer = { rank: 1, points: 800, user: { uuid: 'me', name: 'TEST DATA me' } };
  // Two players tied at the top: only the reader's own row is theirs.
  assert.equal(isViewerEntry(viewer, row('me', 1, 800)), true);
  assert.equal(isViewerEntry(viewer, row('other', 1, 800)), false);
  // An older server without viewer.user falls back to rank and points.
  assert.equal(isViewerEntry({ rank: 3, points: 500 }, row('anyone', 3, 500)), true);
  assert.equal(isViewerEntry({ rank: 3, points: 500 }, row('anyone', 4, 500)), false);
  assert.equal(isViewerEntry(null, row('me', 1, 800)), false);

  for (const file of [['board', 'FrontBoard.tsx'], ['results', 'FinishPosition.tsx']]) {
    const source = read('v2', 'features', 'quiz', 'solo', ...file);
    assert.match(source, /const isYou = \(entry: QuizLeaderboardEntry\) => isViewerEntry\(viewer, entry\);/);
  }
});

test('a rising step grows its lip and front as one', () => {
  const board = read('v2', 'features', 'quiz', 'solo', 'board', 'FrontBoard.tsx');
  assert.match(board, /<span className=\{cn\('flex w-full flex-col', rising && 'v2-solo-podium-step'\)\}>\s*<span aria-hidden className=\{cn\('mt-3 h-3 w-full/);
  assert.equal(board.match(/v2-solo-podium-step/g)?.length, 1);
});
