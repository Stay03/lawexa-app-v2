import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* v2 Stage 1, item 3: every load of Invitations told a regular user "Some
 * invitations couldn't be checked just now". `GET /channel-invitations` 403s for
 * anyone who cannot open Team Channels, and the screen read that as a failed
 * inbox (Tester Claude's walk, 18 October 2026). */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('channel invitations are asked for only by a reader who can open Team Channels', () => {
  const screen = read('v2', 'features', 'invitations', 'InvitationsScreen.tsx');
  assert.match(screen, /const channelsOn = eligible && session\.canAccessTeamChannels;/);
  assert.match(screen, /\.\.\.invitationsQueries\.channels\(\{ viewerId \}\),\s*enabled: channelsOn,/);
  const count = read('v2', 'features', 'invitations', 'use-pending-count.ts');
  assert.match(count, /invitationsQueries\.channels\(\{ viewerId \}\), enabled: channelsEnabled \}/);
  const spaces = read('v2', 'features', 'spaces', 'list', 'SpacesBrowser.tsx');
  assert.match(spaces, /channelsEnabled: eligible && session\.canAccessTeamChannels,/);
});

test('an inbox that is not asked for neither holds the skeleton nor counts as failed', () => {
  const screen = read('v2', 'features', 'invitations', 'InvitationsScreen.tsx');
  // A disabled query stays `isPending` in TanStack v5: it must not be in the set.
  assert.match(
    screen,
    /const asked = channelsOn\s*\? \[organizationsQuery, spacesQuery, channelsQuery\]\s*: \[organizationsQuery, spacesQuery\];/,
  );
  assert.match(screen, /const isPending = asked\.some\(\(query\) => query\.isPending\);/);
  assert.match(screen, /const allFailed = failed\.length === asked\.length;/);
  assert.doesNotMatch(screen, /failed\.length === 3/);
});

test('the empty inbox names channels only to a reader who can open them', () => {
  const states = read('v2', 'features', 'invitations', 'states.tsx');
  assert.match(states, /const places = channels \? 'organization, space or channel' : 'organization or space';/);
  assert.match(read('v2', 'features', 'invitations', 'InvitationsScreen.tsx'), /<InvitationsEmptyState channels=\{channelsOn\} \/>/);
});
