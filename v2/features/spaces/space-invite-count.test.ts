import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { spaceInvitesLabel } from './model';

/* Stay, 23 October 2026, 11:21Z: the line under a Space's name ends with the
 * invites not accepted yet, "Work · Private · 2 members · 1 invite sent", for
 * whoever manages the people. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('the invites label counts what waits, and says nothing at none or when the viewer is not told', () => {
  assert.equal(spaceInvitesLabel(1), '1 invite sent');
  assert.equal(spaceInvitesLabel(3), '3 invites sent');
  assert.equal(spaceInvitesLabel(0), null);
  assert.equal(spaceInvitesLabel(undefined), null);
});

test('the count is the pending list total, asked for and passed only for a viewer who manages the people', () => {
  const screen = read('detail', 'SpaceScreen.tsx');
  assert.match(screen, /const peopleReads = eligible && space !== null && canManage;\n  const pendingInvites = useQuery\(\{\n    \.\.\.spacesQueries\.members\(spaceUuid, \{ viewerId: session\.userId, status: 'pending' \}\),\n    enabled: peopleReads,/);
  assert.match(screen, /invitesSent=\{peopleReads \? pendingInvites\.data\?\.pagination\.total : undefined\}/);
});
