import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { UserRole } from '@/types/auth';
import type { V2SessionSnapshot } from '@/v2/runtime/session-context';
import { canPublishPublicly, PUBLIC_NEEDS_VERIFIED_AUTHOR } from './model';

/* The solo quiz (backend branch quiz-part1-publish-and-solo, 21 October 2026):
 * a quiz taken alone, kept in a library, found on the explore list or by
 * link. Pure rules first, then the wiring, pinned by source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

const session = (
  role: UserRole | null,
  extra: Partial<V2SessionSnapshot> = {},
): V2SessionSnapshot =>
  ({
    signedIn: role !== null,
    userId: role === null ? null : 7,
    userUuid: role === null ? null : 'u7',
    name: null,
    email: null,
    avatarUrl: null,
    username: null,
    role,
    isVerified: true,
    authProvider: 'google',
    canSetPrice: false,
    isAmbassador: null,
    profileCountryName: null,
    profileCountryCode: null,
    isLawyer: false,
    canAccessTeamChannels: false,
    isVerifiedAuthor: false,
    ...extra,
  }) as V2SessionSnapshot;

/* ── Who may publish ──────────────────────────────────────────────────────── */

test('publishing to everyone follows the server flag, whatever the role says', () => {
  assert.equal(canPublishPublicly(session('user', { isVerifiedAuthor: true })), true);
  assert.equal(canPublishPublicly(session('user')), false);
  assert.equal(canPublishPublicly(session('admin')), false);
  assert.equal(canPublishPublicly(session('researcher')), false);
  assert.equal(canPublishPublicly(session(null)), false);
  assert.match(PUBLIC_NEEDS_VERIFIED_AUTHOR, /verified authors/);
});

test('the flag travels from /auth/me to the snapshot through the DAL and the layout', () => {
  assert.match(read('types', 'auth.ts'), /is_verified_author\?: boolean;/);
  const dal = read('v2', 'runtime', 'session.ts');
  assert.match(dal, /is_verified_author: boolean;/);
  assert.match(dal, /is_verified_author: user\.is_verified_author === true,/);
  assert.match(read('app', 'v2', 'layout.tsx'), /isVerifiedAuthor=\{user\?\.is_verified_author \?\? false\}/);
  const context = read('v2', 'runtime', 'session-context.tsx');
  assert.match(context, /readonly isVerifiedAuthor: boolean;/);
  // Both the memo value and its dependency list carry it, or the snapshot
  // would go stale behind a referentially stable context.
  assert.equal(context.match(/isVerifiedAuthor,/g)?.length, 3);
});
