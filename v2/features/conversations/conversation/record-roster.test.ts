import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpaceRosterEntry } from '@/types/chat';
import type { Member } from '@/types/collab';
import { memberColourIndex, type RosterEntry } from './member-colour';
import { colourRosterFor, rosterFromMembers, rosterFromRecord } from './record-roster';

/* A space chat's colours come from the chat record's own `space_roster` when it
 * lists every asker (backend, 17 October 2026), so a direct open no longer waits
 * a second read for them. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (file: string) => readFileSync(join(here, file), 'utf8').replace(/\r\n/g, '\n');

const RECORD: SpaceRosterEntry[] = [
  { user_uuid: 'u-ada', role: 'member', content_role: 'editor', joined_at: '2026-10-02T09:00:00Z' },
  { user_uuid: 'u-obi', role: 'owner', content_role: 'owner', joined_at: '2026-10-01T09:00:00Z' },
  { user_uuid: 'u-eze', role: 'member', content_role: 'viewer', joined_at: '2026-10-03T09:00:00Z' },
];
/** The same people as the members read gives them. */
const MEMBERS: RosterEntry[] = [
  { uuid: 'u-obi', owner: true, joinedAt: '2026-10-01T09:00:00Z' },
  { uuid: 'u-ada', owner: false, joinedAt: '2026-10-02T09:00:00Z' },
  { uuid: 'u-eze', owner: false, joinedAt: '2026-10-03T09:00:00Z' },
];

test('the record\'s rows in the colour module\'s terms: the owner by either role', () => {
  assert.deepEqual(rosterFromRecord(RECORD), [
    { uuid: 'u-ada', owner: false, joinedAt: '2026-10-02T09:00:00Z' },
    { uuid: 'u-obi', owner: true, joinedAt: '2026-10-01T09:00:00Z' },
    { uuid: 'u-eze', owner: false, joinedAt: '2026-10-03T09:00:00Z' },
  ]);
  assert.equal(rosterFromRecord([{ ...RECORD[0], role: 'member', content_role: 'owner' }])[0].owner, true);
});

test('the record lists every asker: the colours come from it, with no members read', () => {
  const fromRecord = rosterFromRecord(RECORD);
  const askers = ['u-ada', 'u-obi', 'u-ada'];
  const roster = colourRosterFor(fromRecord, null, askers);
  assert.equal(roster, fromRecord);
  // The same colours the members read gives the same people.
  assert.deepEqual(
    [...memberColourIndex(roster ?? [], askers)],
    [...memberColourIndex(MEMBERS, askers)],
  );
});

test('an asker the record does not list (a space past 100): the members read colours everyone', () => {
  const fromRecord = rosterFromRecord(RECORD);
  const askers = ['u-ada', 'u-left-long-ago'];
  assert.equal(colourRosterFor(fromRecord, MEMBERS, askers), MEMBERS);
  // Before the members read answers: no colours yet, the grey they ease in from.
  assert.equal(colourRosterFor(fromRecord, null, askers), null);
});

test('no record roster: the members read, as before', () => {
  assert.equal(colourRosterFor(null, MEMBERS, ['u-ada']), MEMBERS);
  assert.equal(colourRosterFor(null, null, ['u-ada']), null);
});

test('a personal chat is unchanged: no roster from either side, so no colours', () => {
  assert.equal(colourRosterFor(null, null, []), null);
  const controller = read('useConversationController.ts');
  // Both rosters are taken only where the chat shows authors (a space chat).
  assert.match(controller, /\(\) => \(showAuthors && recordRows \? rosterFromRecord\(recordRows\) : null\),/);
  assert.match(controller, /\(\) => \(showAuthors && rosterRows \? rosterFromMembers\(rosterRows\) : null\),/);
  const screen = read('ConversationScreen.tsx');
  assert.match(screen, /const roster = colourRosterFor\(recordRoster, spaceRoster, asked\);/);
  assert.match(screen, /return roster \? memberColourIndex\(roster, asked\) : null;/);
});

test('tagging people stays on the members read', () => {
  const controller = read('useConversationController.ts');
  assert.match(controller, /showAuthors && rosterRows \? spaceMentionOptions\(rosterRows, viewerUuid\) : null/);
});

test('the same people get the same colours from the members read and from the record, a null join time included', () => {
  // The server's order on both lists: joined_at IS NULL, joined_at desc, id desc.
  const people = [
    { uuid: 'u-eze', role: 'member', content_role: 'viewer', joined_at: '2026-10-03T09:00:00Z', created_at: '2026-09-01T09:00:00Z' },
    { uuid: 'u-ada', role: 'member', content_role: 'editor', joined_at: '2026-10-02T09:00:00Z', created_at: '2026-09-02T09:00:00Z' },
    { uuid: 'u-obi', role: 'owner', content_role: 'owner', joined_at: '2026-10-01T09:00:00Z', created_at: '2026-09-03T09:00:00Z' },
    // No join time, and the oldest creation: the old created_at fallback put
    // them first on the members read and last on the record.
    { uuid: 'u-kem', role: 'member', content_role: 'editor', joined_at: null, created_at: '2026-08-01T09:00:00Z' },
  ];
  const members = people.map(
    (p) => ({ user: { uuid: p.uuid }, role: p.role, content_role: p.content_role, joined_at: p.joined_at, created_at: p.created_at }) as unknown as Member,
  );
  const record: SpaceRosterEntry[] = people.map((p) => ({
    user_uuid: p.uuid, role: p.role, content_role: p.content_role, joined_at: p.joined_at,
  }));
  const askers = ['u-kem', 'u-ada', 'u-eze', 'u-obi'];
  const fromMembers = [...memberColourIndex(rosterFromMembers(members), askers)];
  const fromRecord = [...memberColourIndex(rosterFromRecord(record), askers)];
  assert.deepEqual(fromRecord, fromMembers);
  // The owner first, then by join time, the member with none last.
  assert.deepEqual(fromMembers, [['u-obi', 0], ['u-ada', 1], ['u-eze', 2], ['u-kem', 3]]);
  // Whatever order either list arrives in.
  assert.deepEqual([...memberColourIndex(rosterFromRecord([...record].reverse()), askers)], fromMembers);
});
