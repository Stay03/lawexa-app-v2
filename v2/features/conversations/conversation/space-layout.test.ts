import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ConversationAuthor } from '@/types/chat';
import { memberColourIndex, type RosterEntry } from './member-colour';
import { UNNAMED_ASKER, turnSide } from './space-turn';

/*
 * A space chat laid out as Arthur drew it (14 October 2026): the reader's own
 * questions on the right with "You · time", everyone else's on the left with
 * their crest, name and time. The side is decided by the reader's id, or the
 * row this client drew itself (`drawnHere`); a missing or withheld author is
 * never "mine" (techlead's rule). The cases are the techlead's (a)-(f); (e) is in
 * space-marks.test.ts. The rows are .tsx, which this runner does not load, so
 * the side rule is tested as a function and the layout is pinned in source.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

const OWNER: ConversationAuthor = { id: 1, uuid: 'owner', name: 'Ada Okafor', avatar_url: null };
const MEMBER: ConversationAuthor = { id: 2, uuid: 'member', name: 'Precious Ekong', avatar_url: null };
const GONE: ConversationAuthor = { id: 3, uuid: 'gone', name: 'Bola Left', avatar_url: null };

test('(a) the owner and a member each see their own turns on the right and the other’s on the left', () => {
  assert.equal(turnSide({ author: OWNER }, OWNER.id), 'mine');
  assert.equal(turnSide({ author: MEMBER }, OWNER.id), 'theirs');
  assert.equal(turnSide({ author: MEMBER }, MEMBER.id), 'mine');
  assert.equal(turnSide({ author: OWNER }, MEMBER.id), 'theirs');
});

test('(b) a person who left the space is theirs, by name, in the next free colour', () => {
  const roster: RosterEntry[] = [
    { uuid: 'owner', owner: true, joinedAt: '2026-10-01T09:00:00Z' },
    { uuid: 'member', owner: false, joinedAt: '2026-10-02T09:00:00Z' },
  ];
  assert.equal(memberColourIndex(roster, ['gone']).get('gone'), 2, 'after the two on the roster');
  assert.equal(turnSide({ author: GONE }, OWNER.id), 'theirs');
});

test('(c) a withheld author (null) is never mine, even when the reader is unknown', () => {
  assert.equal(turnSide({ author: null }, OWNER.id), 'theirs');
  assert.equal(turnSide({ author: null }, null), 'theirs');
  // Drawn on the left as "Someone", with the neutral crest and no colour.
  assert.equal(UNNAMED_ASKER, 'Someone');
  const turn = read('rows', 'SpaceTurn.tsx');
  assert.match(turn, /const name = author\?\.name \?\? UNNAMED_ASKER;/);
  assert.match(turn, /<MemberAvatar\s+user=\{author\}/);
});

test('a row without the author key is not mine: an old cached page, a resource that skips it', () => {
  assert.equal(turnSide({}, OWNER.id), 'theirs');
  assert.equal(turnSide({ author: undefined }, OWNER.id), 'theirs');
});

test('(f) a turn just sent, before the server answers, is mine; the server’s copy stays mine', () => {
  // The client marks the row it draws; the server's copy names the reader.
  assert.equal(turnSide({ drawnHere: true }, OWNER.id), 'mine');
  assert.equal(turnSide({ drawnHere: true }, null), 'mine', 'before the reader is known');
  assert.equal(turnSide({ author: OWNER }, OWNER.id), 'mine', 'after the swap');
  const engine = readFileSync(join(here, '..', '..', '..', 'runtime', 'chat-engine', 'engine.ts'), 'utf8');
  assert.match(engine, /role: 'user',\s*content,\s*timestamp: new Date\(\),\s*drawnHere: true,/);
  // The row reads the side from the message itself.
  const row = read('rows', 'UserMessageRow.tsx');
  assert.match(row, /side=\{turnSide\(message, viewerId\)\}/);
});

test('the two sides as Arthur drew them', () => {
  const turn = read('rows', 'SpaceTurn.tsx');
  // Mine: right, the bubble, then "You · 10:36 AM" under it, always shown.
  assert.match(turn, /if \(side === 'mine'\) \{\s*return \(\s*<div className="flex flex-col items-end" style=\{style\}>\s*\{children\}\s*<div className="text-muted-foreground mt-1\.5 text-xs tabular-nums">\s*<span aria-hidden>You · \{at\}<\/span>/);
  // Theirs: left, the crest, then the name and the time on one line, the question under it.
  assert.match(turn, /<div className="flex min-w-0 items-start gap-2\.5" style=\{style\}>\s*<MemberAvatar/);
  assert.match(turn, /\{name\}\s*<\/span>\s*<span aria-hidden className="text-muted-foreground shrink-0 text-xs tabular-nums">\s*\{at\}/);
});

test('(d) a personal chat keeps its row: one right-hand bubble, no names, no crests', () => {
  const row = read('rows', 'UserMessageRow.tsx');
  // Only a space chat (showAuthor) takes the new layout.
  assert.match(row, /if \(showAuthor\) \{[\s\S]*?<SpaceTurn[\s\S]*?\n {2}\}\n\n {2}return \(\n {4}<div\n {6}onClick=\{\(\) => setShowTime\(\(v\) => !v\)\}\n {6}className="group flex flex-col items-end"/);
  // And the answers carry Lawexa's mark only there.
  const list = read('MessageList.tsx');
  assert.match(list, /const marks = useMemo\(\(\) => \(showAuthors \? spaceMarks\(groups\) : null\), \[groups, showAuthors\]\);/);
  assert.match(list, /\{answerMark \? <LawexaAnswerMark time=\{answerMark\} \/> : null\}/);
  assert.match(list, /\{marks\?\.\[gi\]\?\.day \? <DaySeparator label=\{dayLabel\(marks\[gi\]\.day, nowMinute\)\} \/> : null\}/);
});
