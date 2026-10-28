import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { QuizLeaderboard } from '@/types/channel-quiz';
import { isViewerEntry } from './home-model';
import { finishPosition, opensOnPodium, podiumFlight, PRIVATE_UNRANKED_LINE, UNRANKED_LINE } from './results/position-model';

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
  assert.match(block, /\.\.\.soloQuizQueries\.leaderboard\(quizUuid, \{ viewerId \}\),/);
  assert.match(block, /const position = finishPosition\(board, runPoints/);
  // A board that fails to load leaves the space as it was.
  assert.match(block, /if \(boardQuery\.isError \|\| !boardQuery\.data\) return null;/);
  // View leaderboard opens the quiz page's own board.
  assert.match(block, /href=\{`\$\{quizFrontHref\(quizUuid\)\}#quiz-front-board`\}/);
  // The small podium stays for a podium finish (Arthur's pick), in place of the "#3 of 16" line.
  assert.match(block, /const onPodium = position\.kind === 'ranked' && position\.podiumPlace !== null;/);
  assert.match(block, /\{onPodium \? \(\s*<PodiumMoment/);
  assert.match(block, /\{onPodium \? null : \(\s*<p className="flex items-center gap-2 font-comfortaa/);
  // The "better than" line stays either way.
  assert.match(block, /\{position\.kind === 'ranked' && position\.standing \? \(/);
  assert.match(block, /<Podium entries=\{entries\} isYou=\{isYou\} rising=\{playing\} \/>/);
});

test('only a public quiz asks for its board, so a link-only or private finish sends no request', () => {
  const position = readFileSync(join(process.cwd(), 'v2', 'features', 'quiz', 'solo', 'results', 'FinishPosition.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(position, /useQuery\(\{\s*\.\.\.soloQuizQueries\.leaderboard\(quizUuid, \{ viewerId \}\),\s*enabled: publicQuiz === true,\s*\}\);/);
  assert.match(position, /if \(publicQuiz === false\) return null;/);
  assert.match(position, /if \(publicQuiz === null \|\| boardQuery\.isPending\) return <FinishPositionSkeleton \/>;/);
  // A quiz detail that fails to load never leaves the skeleton up.
  const screen = readFileSync(join(process.cwd(), 'v2', 'features', 'quiz', 'solo', 'results', 'AttemptResultsScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(screen, /const publicQuiz = detailQuery\.isError \? false : visibility === null \? null : visibility === 'public';/);
  assert.match(screen, /publicQuiz=\{publicQuiz\}/);
  // The screen's own read of the board (for the podium) is public-only too.
  assert.match(screen, /useQuery\(\{\s*\.\.\.soloQuizQueries\.leaderboard\(quizUuid \?\? '', \{ viewerId \}\),\s*enabled: quizUuid !== null && publicQuiz === true,\s*\}\);/);
});

test('the podium plays first, full screen over the results, for a top-three finish, then the score by itself', () => {
  const screen = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptResultsScreen.tsx');
  // Reduced motion, or a podium already seen on this attempt: straight to the results.
  assert.match(screen, /useState\(\(\) => prefersReducedMotion\(\) \|\| podiumAlreadySeen\(attemptUuid\)\)/);
  // Until the board says, the skeleton stays, so nothing swaps under the reader.
  assert.match(screen, /if \(!podiumDone && \(publicQuiz === null \|\| \(publicQuiz && boardQuery\.isPending\)\)\) \{\s*return \(\s*<div className=\{RESULTS_COLUMN\}>\s*<AttemptResultsSkeleton \/>/);
  assert.match(screen, /const podiumFirst = !podiumDone && board !== null && opensOnPodium\(board, score\.points\);/);
  // One layer over the results, which sit still and out of reach underneath.
  assert.match(screen, /\{podiumFirst && board \? \(\s*<PodiumStage/);
  assert.match(screen, /<div className=\{RESULTS_COLUMN\} inert=\{podiumFirst\}>/);
  assert.match(screen, /onDone=\{finishPodium\}/);
  // Once per attempt, and focus back to the results' heading.
  assert.match(screen, /rememberPodiumSeen\(attemptUuid\);\s*setPodiumDone\(true\);/);
  assert.match(screen, /document\.getElementById\('attempt-results-heading'\)\?\.focus\(\{ preventScroll: true \}\)/);
  const summary = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptSummary.tsx');
  assert.match(summary, /id="attempt-results-heading"\s*tabIndex=\{-1\}/);
  // The small podium never rises a second time.
  assert.match(screen, /podiumPlayed=\{podiumFirst \|\| podiumDone\}/);
  const block = read('v2', 'features', 'quiz', 'solo', 'results', 'FinishPosition.tsx');
  assert.match(block, /!played && !prefersReducedMotion\(\) && onPodium \? 'waiting' : 'still',/);

  const stage = read('v2', 'features', 'quiz', 'solo', 'results', 'PodiumStage.tsx');
  assert.match(stage, /role="dialog"\s*aria-modal="true"\s*aria-labelledby="podium-stage-heading"/);
  // Arthur's pick: it moves on by itself about 3s after the confetti has fallen; no "See my score".
  assert.match(stage, /export const PODIUM_HOLD_MS = 3000;/);
  assert.match(stage, /if \(confetti !== 'fallen'\) return;\s*const timer = window\.setTimeout\(leave, PODIUM_HOLD_MS\);/);
  // However it ends, the ground clears in place (no band) while the stage's own podium moves down
  // into the small podium's place, transform only (Arthur: "the same podium to move down into its place").
  assert.match(stage, /export const PODIUM_SLIDE_MS = 550;/);
  assert.match(stage, /'transition-colors duration-\[550ms\] ease-out',\s*leaving && 'pointer-events-none bg-transparent',/);
  assert.match(stage, /if \(!leaving\) return;\s*const timer = window\.setTimeout\(onDone, PODIUM_SLIDE_MS\);/);
  assert.doesNotMatch(stage, /translate-y-full|PODIUM_FADE_MS/);
  // On a phone the small podium's spot is scrolled into view first, while the stage still covers the results.
  assert.match(stage, /small\?\.scrollIntoView\(\{ block: 'center', behavior: 'instant' \}\);\s*const from = podiumRef\.current\?\.getBoundingClientRect\(\);/);
  assert.match(stage, /flight\s*\?\s*\{ transform: flight, transition: `transform \$\{PODIUM_SLIDE_MS\}ms cubic-bezier\(0\.22, 1, 0\.36, 1\)` \}/);
  // Only one podium is ever seen: the small one is hidden until this one lands on it.
  assert.match(screen, /podiumCovered=\{podiumFirst\}/);
  assert.match(block, /data-small-podium=""\s*className=\{cn\('w-full', \(phase === 'waiting' \|\| covered\) && 'opacity-0', !playing && 'v2-solo-podium-still'\)\}/);
  assert.doesNotMatch(stage, /<RaisedButton|>\s*See my score/);
  // Skip (focused) or Escape ends it at once.
  assert.match(stage, /ref=\{skipRef\}\s*type="button"\s*onClick=\{leave\}/);
  assert.match(stage, /skipRef\.current\?\.focus\(\{ preventScroll: true \}\);/);
  assert.match(stage, /if \(event\.key === 'Escape'\) leave\(\);/);
  assert.match(stage, /<Podium entries=\{entries\} isYou=\{isYou\} rising=\{playing\} \/>/);

  const css = read('v2', 'features', 'quiz', 'solo', 'solo-quiz.css');
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  for (const name of ['.v2-solo-podium-step', '.v2-solo-podium-face', '.v2-solo-podium-climb']) {
    assert.ok(reduced.includes(name), `${name} is off under reduced motion`);
  }
  assert.match(css, /\.v2-solo-podium-still :is\(\.v2-solo-podium-step, \.v2-solo-podium-face, \.v2-solo-podium-climb\) \{\s*animation: none;/);
  // About two seconds: the climb starts at 1s and lasts 0.9s.
  assert.match(css, /animation: v2-solo-podium-climb 900ms cubic-bezier\(0\.34, 1\.3, 0\.64, 1\) 1000ms both;/);
});

test('the results open on the podium only when this run put the reader’s face on it', () => {
  const entries = (me: number) =>
    [1, 2, 3, 4].map((rank) => ({
      rank,
      points: 1000 - rank * 100,
      correct_count: 5,
      question_count: 5,
      achieved_at: null,
      user: { uuid: rank === me ? 'me' : `p${rank}`, name: `TEST DATA ${rank}` },
    }));
  const board = (me: number, viewerRank: number, viewerPoints: number) => ({
    player_count: 4,
    entries: entries(me),
    viewer: { rank: viewerRank, points: viewerPoints, achieved_at: null, user: { uuid: 'me', name: 'TEST DATA me' } },
  });
  assert.equal(opensOnPodium(board(2, 2, 800), 800), true);
  // Outside the top three.
  assert.equal(opensOnPodium(board(4, 4, 600), 600), false);
  // A best that is on the podium, from an earlier run: this run did not earn it.
  assert.equal(opensOnPodium(board(2, 2, 800), 500), false);
  // Tied for third but sorted fourth: their face is not on the podium.
  assert.equal(opensOnPodium(board(4, 3, 600), 600), false);
  // Not ranked.
  assert.equal(opensOnPodium({ player_count: 4, entries: entries(0), viewer: null }, 700), false);
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
  const screen = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptResultsScreen.tsx');
  assert.match(screen, /isYou=\{\(entry\) => isViewerEntry\(board\.viewer, entry\)\}/);
});

test('a rising step grows its lip and front as one', () => {
  const board = read('v2', 'features', 'quiz', 'solo', 'board', 'FrontBoard.tsx');
  assert.match(board, /<span className=\{cn\('flex w-full flex-col', rising && 'v2-solo-podium-step'\)\}>\s*<span aria-hidden className=\{cn\('mt-3 h-3 w-full/);
  assert.equal(board.match(/v2-solo-podium-step/g)?.length, 1);
});

test('the podium flies from its own box to the small podium’s, as one move and scale', () => {
  // From its top left corner: the move between the two boxes, then the scale between their widths.
  assert.equal(
    podiumFlight({ top: 300, left: 20, width: 350 }, { top: 640, left: 30, width: 330, height: 260 }),
    'translate(10px, 340px) scale(0.943)',
  );
  // The same box: no move at all.
  assert.equal(podiumFlight({ top: 100, left: 0, width: 384 }, { top: 100, left: 0, width: 384, height: 300 }), 'translate(0px, 0px) scale(1.000)');
  // Nothing to land on (no small podium, or not laid out): no flight; the podium fades with the ground.
  assert.equal(podiumFlight({ top: 300, left: 20, width: 350 }, null), null);
  assert.equal(podiumFlight({ top: 300, left: 20, width: 350 }, { top: 0, left: 0, width: 0, height: 0 }), null);
});
