import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { VERIFIED_AUTHOR_HINT, verifiedAuthorToast } from './verified-author-model';

/* A "Verified author" switch on the admin user page (Arthur's B, 31 October
 * 2026): an admin marks someone as a verified author, or not, themselves. A
 * verified author may list quizzes for everyone, and their published public
 * notes are used in Lawexa's answers. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the switch says what a verified author may do, and the toast says what changed', () => {
  assert.equal(VERIFIED_AUTHOR_HINT, "Can list quizzes for everyone. Their published public notes are used in Lawexa's AI answers.");
  assert.equal(verifiedAuthorToast('TEST DATA Editor', true), 'TEST DATA Editor is now a verified author');
  assert.equal(verifiedAuthorToast('TEST DATA Editor', false), 'TEST DATA Editor is no longer a verified author');
});

test('the switch writes the flag, and the page shows the server’s answer', () => {
  const api = read('lib', 'api', 'admin.ts');
  assert.match(api, /apiClient\.put<AdminVerifiedAuthorResponse>\(\s*`\/users\/\$\{uuid\}\/verified-author`,\s*\{ is_verified_author: isVerifiedAuthor \}\s*\)/);
  const hook = read('lib', 'hooks', 'useAdmin.ts');
  assert.match(hook, /data: \{ \.\.\.cached\.data, is_verified_author: response\.data\.is_verified_author \}/);
  const toggle = read('components', 'admin', 'VerifiedAuthorSwitch.tsx');
  // It holds while the request is out; a refusal says the server's words (no global error toast on admin).
  assert.match(toggle, /disabled=\{mutation\.isPending\}/);
  assert.match(toggle, /onError: \(error\) => toast\.error\(extractApiError\(error\)\.message\)/);
  assert.match(toggle, /aria-describedby=\{`\$\{id\}-hint`\}/);
  // Shown once the admin detail sends the flag (Backend's one line to UserDetailResource).
  const header = read('components', 'admin', 'UserDetailHeader.tsx');
  assert.match(header, /\{typeof user\.is_verified_author === 'boolean' && \(/);
  assert.match(header, /isVerifiedAuthor=\{user\.is_verified_author\}/);
});
