import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMPAIGN_LINE,
  formatClock,
  formatCount,
  formatWords,
  ordinal,
  shareName,
  shareUrl,
  VIBES,
  vibeFor,
} from '@/lib/wrapped/copy';
import { FRAME_MS, framesToPlay, initialStory, progressOf, storyReducer, tapSide } from '@/lib/wrapped/story-model';
import { fitText, wrapWords } from '@/lib/wrapped/text-fit';

/* Lawexa Wrapped, Bar Finals edition (thread f833c285, live 8 November 2026):
 * the vibe bank, the number rules and the story viewer's taps. */

test('the vibe bank holds Arthur’s 30 lines and the seven campus lines, each shown only to its campus', () => {
  assert.equal(VIBES.size, 37);
  assert.equal(vibeFor(1).line, 'No rage bait me.');
  assert.equal(vibeFor(28).campus, 'abuja');
  assert.equal(vibeFor(31).line, 'Eko o ni baje. My wig no go spoil too.');
  assert.equal(vibeFor(35).line, 'Bar Finals dry me like kilishi. Still spicy.');
  assert.equal(vibeFor(37).campus, 'abuja');
  // 38 is spare on the server: the main card stands in, never a blank one.
  assert.equal(vibeFor(38).id, 1);
  for (const vibe of VIBES.values()) assert.ok(['gold', 'lilac', 'coral', 'lime'].includes(vibe.colour));
  assert.deepEqual([...CAMPAIGN_LINE], ['The Law.', 'The Bar.', 'The Bench.']);
});

test('numbers get commas and a 9,999+ cap; words keep their size; the clock reads like a person', () => {
  assert.equal(formatCount(412), '412');
  assert.equal(formatCount(9800), '9,800');
  assert.equal(formatCount(9999), '9,999');
  assert.equal(formatCount(12000), '9,999+');
  assert.equal(formatCount(-3), '0');
  assert.equal(formatWords(1_234_000), '1.2 million');
  assert.equal(formatWords(86400), '86,400');
  assert.equal(formatClock('03:47'), '3:47 am');
  assert.equal(formatClock('00:05'), '12:05 am');
  assert.equal(formatClock('bad'), 'bad');
  assert.equal(ordinal(1), '1st');
  assert.equal(ordinal(3), '3rd');
  assert.equal(ordinal(11), '11th');
  assert.equal(ordinal(22), '22nd');
});

test('the share card names a student by first name and last initial only, and its link carries the code', () => {
  assert.equal(shareName('Adaeze', 'o'), 'Adaeze O.');
  assert.equal(shareName('Oluwadamilareee', null), 'Oluwadamilaree');
  assert.equal(shareUrl('K7Q2'), 'https://lawexa.com/wrapped?r=K7Q2');
  assert.equal(shareUrl(null), 'https://lawexa.com/wrapped');
});

test('a frame plays for 7 s, then the next; the share card waits for the student', () => {
  const count = 3;
  let state = initialStory();
  state = storyReducer(count, state, { type: 'tick', ms: FRAME_MS - 1 });
  assert.equal(state.index, 0);
  state = storyReducer(count, state, { type: 'tick', ms: 1 });
  assert.equal(state.index, 1);
  state = storyReducer(count, state, { type: 'next' });
  assert.equal(state.index, 2);
  state = storyReducer(count, state, { type: 'tick', ms: FRAME_MS * 3 });
  assert.equal(state.index, 2);
  assert.equal(state.done, true);
});

test('hold pauses, a tap on the left goes back, back on the first frame starts it again', () => {
  const count = 3;
  let state = storyReducer(count, initialStory(), { type: 'tick', ms: 2000 });
  state = storyReducer(count, state, { type: 'pause' });
  state = storyReducer(count, state, { type: 'tick', ms: FRAME_MS });
  assert.equal(state.index, 0);
  assert.equal(state.elapsed, 2000);
  state = storyReducer(count, state, { type: 'resume' });
  state = storyReducer(count, state, { type: 'back' });
  assert.deepEqual([state.index, state.elapsed], [0, 0]);
  assert.equal(tapSide(50, 400), 'back');
  assert.equal(tapSide(300, 400), 'next');
  state = storyReducer(count, { ...state, index: 1, elapsed: 3500 }, { type: 'tick', ms: 0 });
  assert.deepEqual(progressOf(count, state), [1, 0.5, 0]);
});

test('a vibe line takes the biggest size that fits its lines, and never splits a word', () => {
  // A fake font: every character is half the size wide.
  const measure = (text: string, size: number) => text.length * size * 0.5;
  const short = fitText('No rage bait me.', { width: 900, maxLines: 4, max: 104, min: 64 }, measure);
  assert.equal(short.size, 104);
  assert.deepEqual(short.lines, ['No rage bait me.']);
  const long = fitText('Five papers. Zero regrets. Okay, small regrets.', { width: 900, maxLines: 2, max: 104, min: 64 }, measure);
  assert.ok(long.size < 104 && long.lines.length <= 2);
  assert.deepEqual(wrapWords('Esq. loading…', 40, 10, measure), ['Esq.', 'loading…']);
});

test('the frames play in story order as the server lists them, with the share card always last', () => {
  assert.deepEqual(framesToPlay([1, 7, 8]), [1, 7, 8]);
  assert.deepEqual(framesToPlay([8, 3, 1, 3, 9, 0]), [1, 3, 8]);
  assert.deepEqual(framesToPlay([]), [8]);
});
