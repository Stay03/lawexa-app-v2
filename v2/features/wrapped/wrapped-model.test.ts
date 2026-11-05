import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CAMPAIGN_LINE,
  PERSONAS,
  formatClock,
  formatCount,
  formatWords,
  ordinal,
  percentileLine,
  personaReason,
  shareName,
  shareUrl,
  VIBES,
  verdictText,
  vibeFor,
} from '@/lib/wrapped/copy';
import { FRAME_MS, framesToPlay, initialStory, progressOf, storyReducer, tapSide } from '@/lib/wrapped/story-model';
import { fitText, wrapWords } from '@/lib/wrapped/text-fit';
import { SHARE_LAYOUT, corsPhotoUrl, personaBanner, shownStickers } from '@/lib/wrapped/share-image';
import { POLAROID, SHARE_HEIGHT, wrappedArt } from '@/lib/wrapped/theme';
import { wrappedSignedIn } from '@/lib/wrapped/access';
import type { WrappedRecord } from '@/lib/wrapped/types';

test('the share card’s words sit around Arthur’s polaroid, never on it, and the link clears his mark', () => {
  // The polaroid, turned −3° around (540, 960): its highest and lowest points.
  const [ox, oy, ow, oh] = POLAROID.outer;
  const turn = (POLAROID.rotationDeg * Math.PI) / 180;
  const corners = [
    [ox, oy],
    [ox + ow, oy],
    [ox, oy + oh],
    [ox + ow, oy + oh],
  ].map(([x, y]) => (x - 540) * Math.sin(turn) + (y - 960) * Math.cos(turn) + 960);
  const top = Math.min(...corners);
  const bottom = Math.max(...corners);
  assert.ok(SHARE_LAYOUT.top.lineBottom < top, 'the vibe line ends above the polaroid');
  assert.ok(SHARE_LAYOUT.bottom.y > bottom, 'the stickers start below the polaroid');
  const stickersEnd = SHARE_LAYOUT.bottom.y + 3 * SHARE_LAYOUT.bottom.stickerH + 2 * SHARE_LAYOUT.bottom.gap;
  // Arthur's foot scribble runs at about y 1690; his mark is an ink disc 64 px in, 96 px wide.
  assert.ok(stickersEnd < 1690, 'the stickers end above the foot scribble');
  assert.ok(SHARE_LAYOUT.link.x > 64 + 96 + 16 && SHARE_LAYOUT.link.y < SHARE_HEIGHT - 64);
  assert.equal(wrappedArt('frame', 7), '/wrapped/frames/frame-07.webp');
  assert.equal(wrappedArt('prop', 31), '/wrapped/props/prop-31.webp');
});

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
  // Each card's colours are Arthur's manifest's: 01 lilac on a gold circle, 37 gold on lilac.
  assert.deepEqual([vibeFor(1).colour, vibeFor(1).circle], ['lilac', 'gold']);
  assert.deepEqual([vibeFor(37).colour, vibeFor(37).circle], ['gold', 'lilac']);
  assert.deepEqual([...CAMPAIGN_LINE], ['The Law.', 'The Bar.', 'The Bench.']);
});

test('the persona’s reason and the percentile line read Backend’s metric keys, and an unknown key shows nothing', () => {
  assert.equal(personaReason({ metric: 'statute_share_pct', value: 46 }), 'Statutes made up 46% of your reading.');
  assert.equal(personaReason({ metric: 'case_share_pct', value: 31 }), 'Cases made up 31% of your reading.');
  assert.equal(personaReason({ metric: 'overnight_share_pct', value: 38 }), '38% of your study days ran past midnight.');
  assert.equal(personaReason({ metric: 'drafts', value: 22 }), 'Lawexa drafted 22 times for you.');
  assert.equal(personaReason({ metric: 'last_minute_share_pct', value: 61 }), '61% of your study days came in the last three weeks.');
  assert.equal(personaReason({ metric: 'something_new', value: 9 }), null);
  assert.equal(percentileLine({ metric: 'judgments_read', value: 94 }), 'You read more judgments than 94% of students on Lawexa.');
  assert.equal(percentileLine({ metric: 'judgments_read', value: 100 }), null);
  assert.equal(percentileLine(null), null);
  // Arthur's campus props (4 November).
  assert.equal(vibeFor(31).prop, 'Wig with an ÈKÓ tag');
  assert.equal(vibeFor(37).prop, 'Hard hat');
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
  const blocks = { overnight: {}, obsession: {}, drafting: {} } as unknown as Pick<WrappedRecord, 'overnight' | 'obsession' | 'drafting'>;
  assert.deepEqual(framesToPlay({ ...blocks, slides: [1, 7, 8] }), [1, 7, 8]);
  assert.deepEqual(framesToPlay({ ...blocks, slides: [8, 3, 1, 3, 9, 0] }), [1, 3, 8]);
  assert.deepEqual(framesToPlay({ ...blocks, slides: [] }), [8]);
});

test('a frame whose block is null is never played, even when the server lists it', () => {
  const record = { slides: [1, 2, 3, 4, 5, 6, 7, 8], overnight: null, obsession: null, drafting: null } as Pick<
    WrappedRecord,
    'slides' | 'overnight' | 'obsession' | 'drafting'
  >;
  assert.deepEqual(framesToPlay(record), [1, 3, 5, 7, 8]);
});

test('Wrapped counts as signed in only with a token and a user, and never for a guest', () => {
  assert.equal(wrappedSignedIn({ token: 't', user: { id: 1 }, isGuest: false }), true);
  assert.equal(wrappedSignedIn({ token: 't', user: null, isGuest: false }), false);
  assert.equal(wrappedSignedIn({ token: null, user: { id: 1 }, isGuest: false }), false);
  assert.equal(wrappedSignedIn({ token: 't', user: { id: 1 }, isGuest: true }), false);
});

test('the share card asks for the photo at its own URL, so a cached copy without CORS is not reused', () => {
  assert.equal(corsPhotoUrl('https://cdn.lawexa.com/avatars/a.jpg'), 'https://cdn.lawexa.com/avatars/a.jpg?wr=1');
  assert.equal(corsPhotoUrl('https://cdn.lawexa.com/avatars/a.jpg?v=3'), 'https://cdn.lawexa.com/avatars/a.jpg?v=3&wr=1');
  assert.equal(corsPhotoUrl(null), null);
});

/* Quiet students (Techlead 3a8433a0, Arthur's lines, thread f833c285, 5 November 2026). TEST DATA. */

test('the report slip shows Arthur’s line in place of "Verdict: Survived", and keeps it when there is none', () => {
  assert.equal(verdictText(null), 'Verdict: Survived');
  assert.equal(verdictText(undefined), 'Verdict: Survived');
  assert.equal(verdictText('   '), 'Verdict: Survived');
  const line = 'You made a brief appearance. The Court looks forward to seeing more of you.';
  assert.equal(verdictText(line), line);
  assert.equal(verdictText(`  ${line} `), line);
  const frames = readFileSync(join(process.cwd(), 'components', 'wrapped', 'frames.tsx'), 'utf8');
  assert.match(frames, /\{verdictText\(record\.verdict_line\)\}/);
  assert.doesNotMatch(frames, />\s*Verdict: Survived\s*</);
  // A line wraps inside the frame: the sticker is capped at the frame's width.
  const css = readFileSync(join(process.cwd(), 'app', 'wrapped', 'wrapped.css'), 'utf8');
  assert.match(css, /\.wr-sticker\[data-verdict='line'\] \{\s*max-width: 100%;/);
});

test('a course with no status shows its name and DONE stamp, and no status line', () => {
  const frames = readFileSync(join(process.cwd(), 'components', 'wrapped', 'frames.tsx'), 'utf8');
  assert.match(frames, /\{course\.status \? <span className="wr-small">\{STATUS_LABELS\[course\.status\]\}<\/span> : null\}/);
  assert.match(frames, /data-status=\{course\.status \? undefined : 'none'\}/);
  const css = readFileSync(join(process.cwd(), 'app', 'wrapped', 'wrapped.css'), 'utf8');
  assert.match(css, /\.wr-slip-row\[data-status='none'\] \.wr-done \{\s*grid-row: auto;/);
});

test('the share card leaves out a sticker whose number is 0, and shows at most three', () => {
  const allZero = [
    { key: 'overnights', value: 0 },
    { key: 'judgments_read', value: 0 },
    { key: 'longest_streak', value: 0 },
  ];
  assert.deepEqual(shownStickers(allZero), []);
  assert.deepEqual(
    shownStickers([{ key: 'overnights', value: 0 }, { key: 'judgments_read', value: 4 }, { key: 'longest_streak', value: '0' }, { key: 'days_active', value: 1 }]).map((s) => s.key),
    ['judgments_read', 'days_active'],
  );
  const four = ['overnights', 'judgments_read', 'longest_streak', 'days_active'].map((key, i) => ({ key, value: i + 1 }));
  assert.equal(shownStickers(four).length, 3);
  assert.equal(shownStickers([{ key: 'best_mock_pct', value: '72' }]).length, 1);
});

test('the share card is drawn even when a fallback font face cannot load (no Arial on the phone)', () => {
  const frame = readFileSync(join(process.cwd(), 'components', 'wrapped', 'ShareFrame.tsx'), 'utf8');
  assert.match(frame, /await Promise\.allSettled\(\[document\.fonts\.load\(/);
  assert.doesNotMatch(frame, /await Promise\.all\(\[document\.fonts\.load\(/);
});

test('every persona fits its banner, 48 px clear of the card’s right edge and above the stickers (Techlead 61f7c6f8)', () => {
  // Unbounded 900 is wide: about 0.82 of the size per letter, a little more than the real face measures.
  const unbounded = (text: string, size: number) => text.length * size * 0.82;
  const turn = (SHARE_LAYOUT.persona.rotationDeg * Math.PI) / 180;
  for (const { name } of Object.values(PERSONAS)) {
    const banner = personaBanner(name, unbounded);
    assert.ok(banner.right <= 1080 - 48, `${name} ends ${1080 - banner.right} px from the edge`);
    assert.ok(banner.lines.length <= 2 && banner.size >= 26, name);
    assert.equal(banner.lines.join(' '), name, 'no word is lost or split');
    for (const line of banner.lines) assert.ok(unbounded(line, banner.size) <= banner.w - SHARE_LAYOUT.persona.pad * 2, `${name}: "${line}" fits inside`);
    const lowest = banner.cy + (banner.h * Math.cos(turn) + banner.w * Math.sin(turn)) / 2;
    assert.ok(lowest < SHARE_LAYOUT.bottom.y, `${name} stays above the stickers`);
  }
  // The default persona, on 57% of cards, takes two lines; a short name stays on one at full size.
  assert.equal(personaBanner('The Steady Learned Friend', unbounded).lines.length, 2);
  assert.deepEqual(personaBanner('The Don', unbounded), { ...personaBanner('The Don', unbounded), size: 40, lines: ['The Don'] });
});
