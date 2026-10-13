import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MEMBER_HUES, memberColourIndex, memberStyle, type RosterEntry } from './member-colour';

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

test('eight colours, wrapping after; light and dark pairs from the crest wheel, no gold', () => {
  assert.equal(MEMBER_HUES.length, 8);
  assert.equal(new Set(MEMBER_HUES).size, 8);
  for (const hue of MEMBER_HUES) assert.ok(!(hue > 55 && hue < 105), `${hue} is in the gold band`);
  assert.deepEqual(memberStyle(8), memberStyle(0));
  assert.deepEqual(memberStyle(0), {
    '--member-bg': 'oklch(0.947 0.036 230)',
    '--member-ink': 'oklch(0.415 0.095 230)',
    '--member-bg-dark': 'oklch(0.315 0.048 230)',
    '--member-ink-dark': 'oklch(0.868 0.072 230)',
  });
});

test('the wiring: roster by uuid, the reader\'s own rows by the reader\'s uuid, personal chats plain', () => {
  const controller = readHere('useConversationController.ts');
  assert.match(controller, /spacesQueries\.members\(spaceUuid \?\? '', \{ viewerId: serverUserId, per_page: 100 \}\),\s*enabled: showAuthors && spaceUuid !== null,/);
  assert.match(controller, /owner: member\.role === 'owner' \|\| member\.content_role === 'owner',/);
  const screen = readHere('ConversationScreen.tsx');
  assert.match(screen, /if \(!spaceRoster\) return null;/);
  assert.match(screen, /if \(message\.role === 'user' && message\.author\?\.uuid\) asked\.push\(message\.author\.uuid\);/);
  const list = readHere('MessageList.tsx');
  // A row this client drew (no author key) is the reader's; a withheld author (null) has none.
  assert.match(list, /const uuid = message\.author === undefined \? viewerUuid : message\.author\?\.uuid;/);
  const row = readHere('rows', 'UserMessageRow.tsx');
  assert.match(row, /style=\{colourIndex === null \? undefined : memberStyle\(colourIndex\)\}/);
  assert.match(row, /member: 'bg-\[var\(--member-bg\)\] dark:bg-\[var\(--member-bg-dark\)\]'/);
  // The text stays the theme's foreground on both grounds.
  assert.match(row, /cn\(BUBBLE_GROUND\[tint\], 'text-foreground rounded-3xl/);
  assert.match(row, /tint === 'member' \? 'text-\[var\(--member-ink\)\] dark:text-\[var\(--member-ink-dark\)\]' : 'text-muted-foreground'/);
});
