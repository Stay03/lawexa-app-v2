import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CHANGEABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PRIORITY,
  assignableRoles,
  canChangeRole,
  displayName,
  roleWithArticle,
} from './change-role-model';
import type { UserRole } from '@/types/auth';

/* The admin "Change role" control (Arthur chose option 3 on 29 October 2026;
 * the techlead approved design d0ed4466 the same day). The rules first, as a
 * full actor × target table, then the wiring, pinned by source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const ALL: UserRole[] = ['superadmin', 'admin', 'researcher', 'user', 'guest', 'bot'];

test('the priorities match the server', () => {
  assert.deepEqual(ROLE_PRIORITY, {
    superadmin: 5,
    admin: 4,
    researcher: 3,
    user: 2,
    guest: 1,
    bot: 0,
  });
  assert.deepEqual([...CHANGEABLE_ROLES], ['superadmin', 'admin', 'researcher', 'user']);
});

/* expected[actor][target] = the roles offered (current role excluded). */
const expected: Record<UserRole, Record<UserRole, string[]>> = {
  superadmin: {
    superadmin: ['admin', 'researcher', 'user'],
    admin: ['superadmin', 'researcher', 'user'],
    researcher: ['superadmin', 'admin', 'user'],
    user: ['superadmin', 'admin', 'researcher'],
    guest: [],
    bot: [],
  },
  admin: {
    superadmin: [],
    admin: [],
    researcher: ['user'],
    user: ['researcher'],
    guest: [],
    bot: [],
  },
  researcher: { superadmin: [], admin: [], researcher: [], user: [], guest: [], bot: [] },
  user: { superadmin: [], admin: [], researcher: [], user: [], guest: [], bot: [] },
  guest: { superadmin: [], admin: [], researcher: [], user: [], guest: [], bot: [] },
  bot: { superadmin: [], admin: [], researcher: [], user: [], guest: [], bot: [] },
};

for (const actor of ALL) {
  for (const target of ALL) {
    const roles = expected[actor][target];
    test(`${actor} on ${target}: offers [${roles.join(', ')}]`, () => {
      assert.deepEqual(assignableRoles(actor, target), roles);
      assert.equal(
        canChangeRole({ actorRole: actor, targetRole: target, isSelf: false }),
        roles.length > 0
      );
    });
  }
}

test('your own account never shows the button, whatever the roles', () => {
  for (const actor of ALL) {
    for (const target of ALL) {
      assert.equal(canChangeRole({ actorRole: actor, targetRole: target, isSelf: true }), false);
    }
  }
});

test('guest and bot are never offered and never changed', () => {
  for (const actor of ALL) {
    for (const target of ALL) {
      const roles: string[] = assignableRoles(actor, target);
      assert.ok(!roles.includes('guest'));
      assert.ok(!roles.includes('bot'));
    }
    assert.equal(canChangeRole({ actorRole: actor, targetRole: 'guest', isSelf: false }), false);
    assert.equal(canChangeRole({ actorRole: actor, targetRole: 'bot', isSelf: false }), false);
  }
});

test('an unknown or missing role offers nothing', () => {
  assert.deepEqual(assignableRoles(null, 'user'), []);
  assert.deepEqual(assignableRoles(undefined, 'user'), []);
  assert.deepEqual(assignableRoles('owner', 'user'), []);
  assert.deepEqual(assignableRoles('superadmin', 'owner'), []);
  assert.deepEqual(assignableRoles('superadmin', null), []);
});

test('a name falls back to "This account"', () => {
  assert.equal(displayName('Ada Obi'), 'Ada Obi');
  assert.equal(displayName('  Ada  '), 'Ada');
  assert.equal(displayName(''), 'This account');
  assert.equal(displayName('   '), 'This account');
  assert.equal(displayName(null), 'This account');
  assert.equal(displayName(undefined), 'This account');
});

test('the article fits the role', () => {
  assert.equal(roleWithArticle('superadmin'), 'a Superadmin');
  assert.equal(roleWithArticle('admin'), 'an Admin');
  assert.equal(roleWithArticle('researcher'), 'a Researcher');
  assert.equal(roleWithArticle('user'), 'a User');
});

test('each offered role has its label and one plain line', () => {
  assert.deepEqual(
    CHANGEABLE_ROLES.map((role) => ROLE_LABELS[role]),
    ['Superadmin', 'Admin', 'Researcher', 'User']
  );
  assert.equal(ROLE_DESCRIPTIONS.superadmin, 'Everything, including other admins’ roles.');
  assert.equal(ROLE_DESCRIPTIONS.admin, 'The admin pages, and roles below Admin.');
  assert.equal(ROLE_DESCRIPTIONS.researcher, 'Research tools, no admin pages.');
  assert.equal(ROLE_DESCRIPTIONS.user, 'The normal app.');
});

test('the header shows the button and dialog only when canChangeRole says so', () => {
  const src = read('components', 'admin', 'UserDetailHeader.tsx');
  assert.match(src, /const showChangeRole = canChangeRole\(\{\s*actorRole,\s*targetRole: user\.role,\s*isSelf,\s*\}\);/);
  assert.match(src, /actorUuid === user\.uuid/);
  assert.match(src, /actorId === user\.id/);
  assert.match(src, /\{showChangeRole && \(\s*<Button/);
  assert.match(src, /\{showChangeRole && \(\s*<ChangeRoleDialog/);
});

test('the dialog saves with mutateAsync, shows the server message inline and names the change', () => {
  const src = read('components', 'admin', 'ChangeRoleDialog.tsx');
  assert.match(src, /mutation\.mutateAsync\(/);
  assert.match(src, /setError\(extractApiError\(err\)\.message\)/);
  assert.match(src, /`Change to \$\{ROLE_LABELS\[picked\]\}`/);
  assert.match(src, /disabled=\{isCurrent\}/);
  assert.match(src, /They will be able to change every account’s role, including yours\./);
  assert.doesNotMatch(src, /useEffect/);
});

test('the API call is PUT /users/{uuid}/role with { role }', () => {
  const src = read('lib', 'api', 'admin.ts');
  assert.match(src, /apiClient\.put<AdminChangeUserRoleResponse>\(\s*`\/users\/\$\{uuid\}\/role`,\s*\{ role \}\s*\)/);
});
