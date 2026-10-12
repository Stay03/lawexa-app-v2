import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  INVITE_IDENTIFIER_HINT,
  inviteRefusalMessage,
  parseInviteIdentifier,
} from './membership/invite-identifier';

/* Invite by username (12 October 2026; backend 6d11c84). A space's invite field
 * reads "email or @username" and sends exactly one of the two; an organization
 * keeps its email field. The parser and the refusal line first, then the wiring
 * pinned by source. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('text with an @ and a dot-domain after it is an email, kept as typed', () => {
  assert.deepEqual(parseInviteIdentifier('ada@example.com'), { email: 'ada@example.com' });
  assert.deepEqual(parseInviteIdentifier('Ada.Obi@Firm.co.uk'), { email: 'Ada.Obi@Firm.co.uk' });
  assert.deepEqual(parseInviteIdentifier('  ada@example.com  '), { email: 'ada@example.com' });
});

test('anything else is a username, its leading @ dropped and folded to lowercase', () => {
  assert.deepEqual(parseInviteIdentifier('@ada_obi'), { username: 'ada_obi' });
  assert.deepEqual(parseInviteIdentifier('ada_obi'), { username: 'ada_obi' });
  assert.deepEqual(parseInviteIdentifier('  @Ada_Obi  '), { username: 'ada_obi' });
  assert.deepEqual(parseInviteIdentifier('a1b'), { username: 'a1b' });
  assert.deepEqual(parseInviteIdentifier(`@${'a'.repeat(30)}`), { username: 'a'.repeat(30) });
});

test('text that is neither an email nor a username shape is refused before sending', () => {
  for (const bad of [
    '',
    '   ',
    '@',
    '@ab',
    'ada@example',
    '@ada.obi',
    'ada obi',
    'ada-obi',
    '_ada',
    'ada@',
    'a'.repeat(31),
    `@${'a'.repeat(31)}`,
  ]) {
    assert.equal(parseInviteIdentifier(bad), null, JSON.stringify(bad));
  }
  assert.doesNotMatch(INVITE_IDENTIFIER_HINT, /[—–]/);
});

test('an unknown username names the handle; every other refusal is the server line', () => {
  const unknown = {
    status: 422,
    message: 'The selected username is invalid.',
    errors: { username: ['The selected username is invalid.'] },
  };
  assert.equal(
    inviteRefusalMessage(unknown, { username: 'ada_obi' }),
    'No one on Lawexa has the username @ada_obi.',
  );
  // An email invite never reads as a username refusal.
  assert.equal(inviteRefusalMessage(unknown, { email: 'a@b.c' }), unknown.message);
  const unknownEmail = {
    status: 422,
    message: 'No user found with that email.',
    errors: { email: ['No user found with that email.'] },
  };
  assert.equal(inviteRefusalMessage(unknownEmail, { email: 'a@b.c' }), unknownEmail.message);
  const duplicate = { status: 409, message: 'Already a member.', errors: null };
  assert.equal(inviteRefusalMessage(duplicate, { username: 'ada_obi' }), duplicate.message);
});

test('the dialog is told its identifier: spaces take a username, organizations email only', () => {
  const dialog = read('v2', 'features', 'collab', 'membership', 'InvitePeopleDialog.tsx');
  assert.match(dialog, /identifier === 'email' \? \{ email: trimmed \} : parseInviteIdentifier\(trimmed\)/);
  assert.match(dialog, /setError\(inviteRefusalMessage\(apiError, invitee\)\);/);
  assert.match(dialog, /'Email or username'/);
  assert.match(dialog, /'name@example\.com or @username'/);
  assert.match(dialog, /type=\{byEmail \? 'email' : 'text'\}/);
  assert.match(dialog, /inputMode=\{byEmail \? undefined : 'email'\}/);
  assert.match(dialog, /autoCapitalize=\{byEmail \? undefined : 'off'\}/);
  assert.match(dialog, /autoComplete="off"/);

  const space = read('v2', 'features', 'spaces', 'detail', 'SpaceMembersSheet.tsx');
  assert.match(space, /identifier="email-or-username"/);

  const organization = read('v2', 'features', 'organizations', 'OrganizationMembersSheet.tsx');
  assert.match(organization, /identifier="email"/);
  assert.match(
    organization,
    /onInvite=\{\(\{ invitee, role \}\) => handleInvite\(\{ email: invitee\.email, role \}\)\}/,
  );
  assert.doesNotMatch(organization, /email-or-username/);
});
