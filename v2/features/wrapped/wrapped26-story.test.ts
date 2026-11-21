import { test } from 'node:test';
import assert from 'node:assert/strict';

import { castFor, characterFor } from '@/lib/wrapped26/characters';
import {
  WRAPPED26_SLIDES,
  cardNumber,
  initialStory,
  segmentFill,
  slidesToPlay,
  stageScale,
  storyReducer,
  tapSide,
  type Wrapped26StoryState,
} from '@/lib/wrapped26/story';
import type { Wrapped26SlideId } from '@/lib/wrapped26/types';

/* Wrapped 2026 (thread f833c285; Arthur's build kit, BUILD_SPEC §3–5). */

const FULL = slidesToPlay(['00', '01', '02a', '02b', '03', '04', '05', '06', '07', '08', '09a', '09b', '09c', '09d', '10']);
const THIN = slidesToPlay(['00', '03', '04', '09a', '09b', '09c', '09d', '10']);

const run = (slides: readonly Wrapped26SlideId[], state: Wrapped26StoryState, ...actions: Parameters<typeof storyReducer>[2][]) =>
  actions.reduce((current, action) => storyReducer(slides, current, action), state);

test('09c folds into 09b (the wheel locks in on the same slide) and unknown ids are dropped', () => {
  assert.deepEqual(FULL.slice(-4), ['09a', '09b', '09d', '10']);
  assert.deepEqual(slidesToPlay(['00', '11', '10']), ['00', '10']);
});

test('progress events number slides by the full kit order, so skips never shift them', () => {
  assert.equal(cardNumber('00'), 1);
  assert.equal(cardNumber('02a'), 3);
  assert.equal(cardNumber('09d'), 14);
  assert.equal(cardNumber('10'), 15);
});

test('the intro, the guess and the share slide wait for their own control', () => {
  const atIntro = run(FULL, initialStory(), { type: 'tick', ms: 60000 }, { type: 'tap-next' });
  assert.equal(atIntro.index, 0);
  const started = run(FULL, atIntro, { type: 'advance' }, { type: 'settled' });
  assert.equal(FULL[started.index], '01');
  const atGuess = run(FULL, started, { type: 'tick', ms: 5200 }, { type: 'settled' }, { type: 'tap-next' }, { type: 'tick', ms: 60000 });
  assert.equal(FULL[atGuess.index], '02a');
});

test('a slide plays for its duration, then the next comes in', () => {
  const at01 = { ...initialStory(1) };
  assert.equal(run(FULL, at01, { type: 'tick', ms: 5199 }).index, 1);
  const moved = run(FULL, at01, { type: 'tick', ms: 5200 });
  assert.equal(moved.index, 2);
  assert.equal(moved.moving, true);
  assert.equal(moved.direction, 1);
});

test('taps during a transition are queued, one step, never dropped', () => {
  const moving = run(FULL, initialStory(4), { type: 'tap-next' });
  assert.equal(moving.moving, true);
  const queued = run(FULL, moving, { type: 'tap-next' }, { type: 'tap-next' });
  assert.equal(queued.index, 5);
  assert.equal(queued.queued, 'next');
  const after = run(FULL, queued, { type: 'settled' });
  assert.equal(after.index, 6);
  assert.equal(after.moving, true);
});

test('hold pauses the clock, back on the first slide restarts it, back goes back with a reversed push', () => {
  const paused = run(FULL, initialStory(1), { type: 'pause' }, { type: 'tick', ms: 9000 });
  assert.equal(paused.index, 1);
  assert.equal(paused.elapsed, 0);
  const back = run(FULL, initialStory(3), { type: 'back' });
  assert.equal(back.index, 2);
  assert.equal(back.direction, -1);
  assert.equal(run(FULL, { ...initialStory(0), elapsed: 300 }, { type: 'back' }).index, 0);
});

test('the share slide holds at the end', () => {
  const end = run(FULL, initialStory(FULL.length - 1), { type: 'tick', ms: 60000 }, { type: 'tap-next' });
  assert.equal(end.index, FULL.length - 1);
});

test('ten segments: shared steps fill in turn, the intro shows none, the thin cut skips ahead', () => {
  assert.deepEqual(segmentFill(FULL, 0, 0), Array(10).fill(0));
  const reveal = segmentFill(FULL, FULL.indexOf('02b'), 2600);
  assert.equal(reveal[0], 1);
  assert.equal(reveal[1], 0.75);
  assert.equal(reveal[2], 0);
  const thinPhysical = segmentFill(THIN, THIN.indexOf('03'), 0);
  assert.deepEqual(thinPhysical.slice(0, 3), [1, 1, 0]);
  const reveal09d = segmentFill(FULL, FULL.indexOf('09d'), 0);
  assert.equal(reveal09d[8].toFixed(3), (2 / 3).toFixed(3));
});

test('lawyers flip ink and paper on 02a to 08; the casting and the share slide are the same', () => {
  assert.equal(WRAPPED26_SLIDES['02a'].theme.undergraduates, 'paper');
  assert.equal(WRAPPED26_SLIDES['02a'].theme.lawyers, 'ink');
  assert.equal(WRAPPED26_SLIDES['07'].theme.lawyers, 'paper');
  assert.equal(WRAPPED26_SLIDES['09d'].theme.lawyers, 'ink');
  assert.equal(WRAPPED26_SLIDES['10'].theme.lawyers, 'paper');
});

test('the wheel holds 14 for each track: students get Elle Woods, lawyers Tega Castle', () => {
  const students = castFor('undergraduates').map((c) => c.name);
  const lawyers = castFor('lawyers').map((c) => c.name);
  assert.equal(students.length, 14);
  assert.equal(lawyers.length, 14);
  assert.ok(students.includes('Elle Woods') && !students.includes('Tega Castle'));
  assert.ok(lawyers.includes('Tega Castle') && !lawyers.includes('Elle Woods'));
  assert.equal(characterFor('undergraduates', 'Tega Castle'), null);
  assert.equal(characterFor('lawyers', 'Donna Paulsen')?.accent, 'lilac');
});

test('taps on the left 30% go back, and the stage fits the 1080×1920 canvas inside the screen', () => {
  assert.equal(tapSide(100, 1000), 'back');
  assert.equal(tapSide(300, 1000), 'next');
  assert.equal(stageScale(390, 844), 390 / 1080);
  assert.equal(stageScale(1440, 900), 900 / 1920);
});
