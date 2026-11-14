import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { QuizLeaderboard } from '@/types/channel-quiz';
import { LIVE_PODIUM_HEADING, livePodiumHeading, revealsLivePodium } from './live-board';

/* The live game's full-screen podium (Arthur, f730f71c, 14 November 2026:
 * "announcing the 3rd then 2nd and then 1st with confetti burst ... which then
 * places nicely with the rest of the screen. the animation can be skipped. we
 * had done something similar with the public quizzes and would like that
 * here"). It is the public quiz's own stage, never a copy. TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const entry = (rank: number, uuid: string) => ({
  rank,
  user: { uuid, name: `TEST DATA ${uuid}`, avatar_url: null },
  points: 1000 - rank * 100,
  correct_count: 3,
  question_count: 5,
  achieved_at: null,
});

test('a game with a podium opens on it; a one-player game, which ranks no one, does not', () => {
  const board = (count: number): QuizLeaderboard => ({
    player_count: count,
    entries: Array.from({ length: count }, (_, index) => entry(index + 1, `p${index}`)),
    viewer: null,
  });
  assert.equal(revealsLivePodium(board(2)), true);
  assert.equal(revealsLivePodium(board(7)), true);
  assert.equal(revealsLivePodium(board(1)), false);
  assert.equal(revealsLivePodium(board(0)), false);
});

test('the headline is the solo one for a reader on the podium, the room\'s for a watcher or anyone below it', () => {
  assert.equal(livePodiumHeading(true, 'You made the Podium!'), 'You made the Podium!');
  assert.equal(livePodiumHeading(false, 'You made the Podium!'), LIVE_PODIUM_HEADING);
});

test('the final scores open on the public quiz\'s own podium stage, once per game, and land on the board\'s podium', () => {
  const phases = read('v2', 'features', 'channels', 'quiz', 'GamePhases.tsx');
  assert.match(phases, /PodiumStage as PodiumReveal,[\s\S]{0,80}\} from '@\/v2\/features\/quiz\/solo\/results\/PodiumStage';/);
  // Never under reduced motion, and once per game in this tab.
  assert.match(phases, /useState\(\(\) => prefersReducedMotion\(\) \|\| podiumAlreadySeen\(gameUuid\)\)/);
  assert.match(phases, /rememberPodiumSeen\(gameUuid\);/);
  assert.match(phases, /<PodiumReveal\s+entries=\{podium\}\s+isYou=\{isYou\}\s+heading=\{livePodiumHeading\(podium\.some\(isYou\), PODIUM_HEADING\)\}\s+tapToSkip\s+onDone=\{finishReveal\}/);
  // The scores sit still and out of reach under it; the board's podium is where it lands, with no second rise.
  assert.match(phases, /<GameStage inert=\{revealing\}>/);
  assert.match(phases, /rising=\{!reveal\}\s+podiumLanding=\{reveal \? \(revealing \? 'covered' : 'landed'\) : undefined\}/);

  const board = read('v2', 'features', 'quiz', 'solo', 'board', 'FrontBoard.tsx');
  assert.match(board, /data-small-podium=\{podiumLanding \? '' : undefined\}/);
  assert.match(board, /podiumLanding === 'covered' && 'opacity-0'/);

  const stage = read('v2', 'features', 'quiz', 'solo', 'results', 'PodiumStage.tsx');
  // The public quiz keeps its own headline and its Skip; the room adds a tap anywhere.
  assert.match(stage, /heading = PODIUM_HEADING,\s+tapToSkip = false,/);
  assert.match(stage, /onClick=\{tapToSkip \? leave : undefined\}/);
  assert.match(stage, /export const PODIUM_HEADING = 'You made the Podium!';/);
});
