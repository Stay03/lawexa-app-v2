import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Space } from '@/types/collab';
import { spaceIsPrivate, spaceListSections } from './list/list-rows';
import { lastMessageLine } from './model';

/* The spaces list, Stay's design of 15 October 2026 ("Spaces list page"):
 * two sections, and each row read like a chat list. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

const space = (uuid: string, extra: Partial<Space>): Space =>
  ({ uuid, name: uuid, type: 'study', is_private: true, ...extra }) as Space;

test('two sections: the spaces the reader owns, then the ones they joined, in the server’s order', () => {
  const rows = [
    space('a', { kind: 'shared', my_content_role: 'editor' }),
    space('b', { kind: 'shared', my_content_role: 'owner' }),
    space('c', { kind: 'team', my_role: 'owner' }),
    space('d', { kind: 'team', my_role: 'member' }),
  ];
  const { mine, joined } = spaceListSections(rows);
  assert.deepEqual(mine.map((s) => s.uuid), ['b', 'c']);
  assert.deepEqual(joined.map((s) => s.uuid), ['a', 'd']);
});

test('private or public: a shared space is always private; a team space says', () => {
  assert.equal(spaceIsPrivate({ kind: 'shared', is_private: false }), true);
  assert.equal(spaceIsPrivate({ kind: 'team', is_private: false }), false);
  assert.equal(spaceIsPrivate({ kind: 'team', is_private: true }), true);
});

test('the row’s second line is the space’s newest message and who sent it', () => {
  const at = '2026-10-15T12:30:00+00:00';
  assert.equal(
    lastMessageLine({ role: 'user', preview: 'Can a tenant withhold rent?', created_at: at, author: { uuid: 'u2', name: 'Ebi Editor' } }, 'u1'),
    'Ebi Editor: Can a tenant withhold rent?',
  );
  assert.equal(lastMessageLine({ role: 'assistant', preview: 'A short answer', created_at: at, author: null }, 'u1'), 'Lawexa: A short answer');
  const row = read('v2', 'features', 'spaces', 'list', 'SpaceRow.tsx');
  assert.match(row, /const line = lastMessageLine\(latest, viewerUuid\);/);
  assert.match(row, />No messages yet</);
  // The time is the message's own, beside it, and one prop turns it off.
  assert.match(row, /const age = showTime && latest \? formatRelativeTime\(latest\.created_at, now\) : '';/);
  assert.match(row, /showTime = true,/);
});

test('line 1: the name and its unread marks, then Private or Public and Work or Study as text at the top right', () => {
  const row = read('v2', 'features', 'spaces', 'list', 'SpaceRow.tsx');
  assert.match(row, /<span className="ml-auto shrink-0 pl-2 text-xs">/);
  assert.match(row, /\{isPrivate \? 'Private' : 'Public'\}/);
  assert.match(row, /'text-violet-600 dark:text-violet-300'/);
  assert.match(row, /'text-emerald-600 dark:text-emerald-400'/);
  assert.match(row, /<span className="text-muted-foreground"> · \{space\.type_label\}<\/span>/);
  // The unread marks come before the facts, right after the name.
  assert.match(row, /<UnreadDot \/>[\s\S]*?<CountBadge[\s\S]*?ml-auto shrink-0 pl-2/);
  // No icons, no role line, no faces, no counts.
  assert.doesNotMatch(row, /lucide-react|PresenceStack|spaceContentCountsLabel|spaceRoleLabel/);
  // Nor the crest's Work/Study corner mark: the words say it (techlead, 15 October 2026).
  assert.match(row, /<SpaceCrest uuid=\{space\.uuid\} name=\{space\.name\} type=\{space\.type\} size="lg" noMark \/>/);
  assert.match(read('v2', 'features', 'collab', 'kit', 'Crest.tsx'), /glyph=\{noMark \? null : type === 'study' \? GraduationCap : Briefcase\}/);
});

test('the list draws the two sections, with headings and counts, and leaves an empty one out', () => {
  const browser = read('v2', 'features', 'spaces', 'list', 'SpacesBrowser.tsx');
  assert.match(browser, /const sections = useMemo\(\(\) => spaceListSections\(spaces \?\? \[\]\), \[spaces\]\);/);
  assert.match(browser, /\['mine', 'Your spaces', sections\.mine\],\s*\['joined', 'Joined', sections\.joined\],/);
  assert.match(browser, /rows\.length > 0 \? \(/);
  assert.match(browser, /viewerUuid=\{viewerUuid\}/);
});
