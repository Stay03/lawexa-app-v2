import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { signInHref } from './sign-in-href';

/* v2 Stage 1, item 1 (Stay, 19 October 2026): "Add the folder button that
 * send to sign in". A visitor sees Save and Add to folder on cases, statutes
 * and notes, and a tap goes to sign in, coming back to the page. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('sign in comes back to the page the visitor was on, in its public form', () => {
  assert.equal(signInHref('/cases/okafor-v-ade'), '/login?redirect=%2Fcases%2Fokafor-v-ade');
  assert.equal(signInHref('/v2/statutes/cama-2020?tab=contents'), '/login?redirect=%2Fstatutes%2Fcama-2020%3Ftab%3Dcontents');
  assert.equal(signInHref('/v2'), '/login?redirect=%2F');
});

test('a guest’s Save and Add to folder go to sign in; an account’s do their work', () => {
  for (const file of [
    ['v2', 'features', 'bookmarks', 'BookmarkButton.tsx'],
    ['v2', 'features', 'notes', 'bookmark', 'NoteBookmarkButton.tsx'],
    ['v2', 'features', 'statutes', 'bookmark', 'StatuteBookmarkButton.tsx'],
  ]) {
    const source = read(...file);
    assert.match(source, /const signIn = useGuestSignIn\(\);/, file.join('/'));
    assert.match(source, /if \(signIn\) \{\s*signIn\(\);\s*return;\s*\}\s*toggle\.mutate/, file.join('/'));
  }
  const folder = read('v2', 'features', 'folders', 'picker', 'AddToFolderButton.tsx');
  assert.match(folder, /onClick=\{\(\) => \(signIn \? signIn\(\) : setOpen\(true\)\)\}/);
  // No picker for a guest: its folders would belong to a throwaway pass.
  assert.match(folder, /\{signIn \? null : <FolderPicker target=\{target\} open=\{open\} onOpenChange=\{setOpen\} \/>\}/);
  const hook = read('v2', 'runtime', 'sign-in-first.ts');
  assert.match(hook, /return role === 'guest' \? go : null;/);
});
