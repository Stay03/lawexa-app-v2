import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpaceRosterEntry } from '@/types/chat';
import { memberColourIndex, type RosterEntry } from './member-colour';
import { colourRosterFor, rosterFromRecord } from './record-roster';

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
  assert.match(controller, /showAuthors && rosterRows\n\s+\? rosterRows\.map/);
  const screen = read('ConversationScreen.tsx');
  assert.match(screen, /const roster = colourRosterFor\(recordRoster, spaceRoster, asked\);/);
  assert.match(screen, /return roster \? memberColourIndex\(roster, asked\) : null;/);
});

test('tagging people stays on the members read', () => {
  const controller = read('useConversationController.ts');
  assert.match(controller, /showAuthors && rosterRows \? spaceMentionOptions\(rosterRows, viewerUuid\) : null/);
});
