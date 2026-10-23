import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { myNotesAddress } from './my-notes-address';

/* Backend's check, 23 October 2026: v1's /notes/mine?search=lagos opened an
 * unfiltered My notes, because its redirect dropped the query. */

const here = dirname(fileURLToPath(import.meta.url));

test('the old My notes link keeps its search and tag, and always lands on the My notes tab', () => {
  assert.equal(myNotesAddress({}), '/notes?tab=mine');
  assert.equal(myNotesAddress({ search: 'lagos' }), '/notes?search=lagos&tab=mine');
  assert.equal(myNotesAddress({ search: 'notice to quit', tags: 'tenancy' }), '/notes?search=notice+to+quit&tags=tenancy&tab=mine');
  assert.equal(myNotesAddress({ tab: 'all', search: 'x' }), '/notes?search=x&tab=mine');
  assert.equal(myNotesAddress({ tags: ['a', 'b'], empty: undefined }), '/notes?tags=a&tags=b&tab=mine');
});

test('the /notes/mine page redirects through it', () => {
  const page = readFileSync(join(here, '..', '..', '..', '..', 'app', 'v2', 'notes', 'mine', 'page.tsx'), 'utf8');
  assert.match(page, /redirect\(myNotesAddress\(await searchParams\)\);/);
  assert.doesNotMatch(page, /redirect\('\/notes\?tab=mine'\)/);
});
