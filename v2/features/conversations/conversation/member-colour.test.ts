import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MEMBER_CHROMA_LIFT, MEMBER_HUES, MEMBER_TINT, chromaLift, memberColourIndex, memberStyle, type RosterEntry } from './member-colour';

// Stay, 13 October 2026: "every owner should have a fixed color user 1, user 2,
// user 3, etc". The rule is pure and tested here; its wiring is pinned in the source.
const here = dirname(fileURLToPath(import.meta.url));
const readHere = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8');

const roster: RosterEntry[] = [
  { uuid: 'carol', owner: false, joinedAt: '2026-10-03T09:00:00Z' },
  { uuid: 'owner', owner: true, joinedAt: '2026-10-05T09:00:00Z' },
  { uuid: 'bola', owner: false, joinedAt: '2026-10-01T09:00:00Z' },
  { uuid: 'late', owner: false, joinedAt: null },
];

test('the Owner is colour 1, then the members in the order they joined', () => {
  const colours = memberColourIndex(roster, []);
  assert.deepEqual([...colours], [['owner', 0], ['bola', 1], ['carol', 2], ['late', 3]]);
});

test('the same roster gives every chat in the space the same colours, whoever asked first', () => {
  const one = memberColourIndex(roster, ['carol', 'owner']);
  const two = memberColourIndex(roster, ['bola']);
  for (const uuid of ['owner', 'bola', 'carol', 'late']) assert.equal(one.get(uuid), two.get(uuid), uuid);
});

test('someone who asked but has left takes the next free colour, by first appearance', () => {
  const colours = memberColourIndex(roster, ['gone-2', 'bola', 'gone-1', 'gone-2']);
  assert.equal(colours.get('gone-2'), 4);
  assert.equal(colours.get('gone-1'), 5);
});

test('eight colours in join order: blue, rose, sand, teal, violet, green, coral, sea-green', () => {
  assert.deepEqual([...MEMBER_HUES], [240, 350, 80, 185, 300, 120, 30, 150]);
  assert.equal(new Set(MEMBER_HUES).size, 8);
  assert.deepEqual(memberStyle(8), memberStyle(0));
  // A faint tint over the neutral bubble (Stay, 14 October 2026; strength B).
  assert.deepEqual(memberStyle(0), {
    '--member-bg': 'oklch(0.96 0.012 240)',
    '--member-ink': 'oklch(0.5 0.04 240)',
    '--member-bg-dark': 'oklch(0.277 0.015 240)',
    '--member-ink-dark': 'oklch(0.78 0.032 240)',
  });
});

test('people next to each other in join order are at least 90° apart, the wrap included', () => {
  // Stay, 14 October 2026: "Don't 2 of the colours looks similar? Blue and green?"
  const apart = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  for (let i = 0; i < MEMBER_HUES.length; i += 1) {
    const a = MEMBER_HUES[i];
    const b = MEMBER_HUES[(i + 1) % MEMBER_HUES.length];
    assert.ok(apart(a, b) >= 90, `${a} and ${b} are ${apart(a, b)}° apart`);
  }
});

test('only the bubbles take sand from the gold band; the crests keep the rule', () => {
  // Gold is the app's information colour. At a bubble's faint tint 80° reads as
  // pale cream, so the bubbles take it (techlead, 14 October 2026); it is the
  // only hue in the band.
  const inGold = MEMBER_HUES.filter((hue) => hue > 55 && hue < 105);
  assert.deepEqual(inGold, [80]);
  assert.ok(MEMBER_TINT.bg.c <= 0.02 && MEMBER_TINT.bgDark.c <= 0.02, 'a faint tint, not a gold fill');
  assert.match(readHere('member-colour.ts'), /the bubbles alone take it/);
});

test('greens and teals carry a little more chroma, still within the faint limits', () => {
  assert.equal(chromaLift(120), MEMBER_CHROMA_LIFT);
  assert.equal(chromaLift(185), MEMBER_CHROMA_LIFT);
  assert.equal(chromaLift(240), 1);
  assert.equal(chromaLift(80), 1);
  assert.deepEqual(memberStyle(3), {
    '--member-bg': 'oklch(0.96 0.015 185)',
    '--member-ink': 'oklch(0.5 0.05 185)',
    '--member-bg-dark': 'oklch(0.277 0.0188 185)',
    '--member-ink-dark': 'oklch(0.78 0.04 185)',
  });
  assert.ok(MEMBER_TINT.bg.c * MEMBER_CHROMA_LIFT <= 0.02 && MEMBER_TINT.bgDark.c * MEMBER_CHROMA_LIFT <= 0.02, 'fills');
  assert.ok(MEMBER_TINT.ink.c * MEMBER_CHROMA_LIFT <= 0.05 && MEMBER_TINT.inkDark.c * MEMBER_CHROMA_LIFT <= 0.05, 'names');
});

test('the tint stays faint: close to the neutral bubble, the names muted', () => {
  // The neutral bubble is --muted (L .97 light, .269 dark, no chroma).
  assert.ok(Math.abs(MEMBER_TINT.bg.l - 0.97) <= 0.015 && MEMBER_TINT.bg.c <= 0.02, 'light fill');
  assert.ok(Math.abs(MEMBER_TINT.bgDark.l - 0.269) <= 0.02 && MEMBER_TINT.bgDark.c <= 0.02, 'dark fill');
  assert.ok(MEMBER_TINT.ink.c <= 0.05 && MEMBER_TINT.inkDark.c <= 0.05, 'muted names');
  // Names keep AA on the page: dark enough on white, light enough on L .145.
  assert.ok(MEMBER_TINT.ink.l <= 0.55 && MEMBER_TINT.inkDark.l >= 0.72, 'name lightness');
});

test('the wiring: roster by uuid, the reader\'s own rows by the reader\'s uuid, personal chats plain', () => {
  const controller = readHere('useConversationController.ts');
  // Enabled early on the cached lists' word (colour-settle.test.ts).
  assert.match(controller, /spacesQueries\.members\(spaceUuid \?\? '', \{ viewerId: serverUserId, per_page: 100 \}\),\s*(\/\/[^\n]*\n\s*)*enabled: spaceUuid !== null && \(detailData === null \|\| showAuthors\),/);
  assert.match(controller, /owner: member\.role === 'owner' \|\| member\.content_role === 'owner',/);
  const screen = readHere('ConversationScreen.tsx');
  assert.match(screen, /if \(!spaceRoster\) return null;/);
  assert.match(screen, /if \(message\.role === 'user' && message\.author\?\.uuid\) asked\.push\(message\.author\.uuid\);/);
  const list = readHere('MessageList.tsx');
  // The row this client drew is the reader's; a withheld or missing author has none.
  assert.match(list, /const uuid = message\.drawnHere \? viewerUuid : message\.author\?\.uuid;/);
  const row = readHere('rows', 'UserMessageRow.tsx');
  assert.match(row, /style=\{colourIndex === null \? undefined : memberStyle\(colourIndex\)\}/);
  assert.match(row, /member: cn\('bg-\[var\(--member-bg\)\] dark:bg-\[var\(--member-bg-dark\)\]', COLOUR_EASE\)/);
  // The text stays the theme's foreground on both grounds.
  assert.match(row, /cn\(BUBBLE_GROUND\[tint\], 'text-foreground rounded-3xl/);
  // A colleague's name, and their crest, in their ink (SpaceTurn).
  const turn = readHere('rows', 'SpaceTurn.tsx');
  assert.match(turn, /const style = colourIndex === null \? undefined : memberStyle\(colourIndex\);/);
  assert.match(turn, /tinted \? 'text-\[var\(--member-ink\)\] dark:text-\[var\(--member-ink-dark\)\]' : 'text-foreground'/);
  assert.match(turn, /\[&_\[data-slot=avatar-fallback\]\]:bg-\[var\(--member-bg\)\]/);
});
