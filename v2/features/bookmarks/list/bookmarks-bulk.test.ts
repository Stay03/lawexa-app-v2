import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { savedItem, savedKey } from './bookmarks-bulk-model';

/* Bulk select on Saved (Arthur, 20 October 2026, part 3): tick saved items on
 * the current tab and take them out of Saved together, with a count first. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

test('a saved row is ticked by its kind and its content id, the pair the server takes', () => {
  assert.equal(savedKey({ type: 'case', contentId: 12 }), 'case:12');
  assert.equal(savedKey({ type: 'folder', contentId: 7 }), 'folder:7');
  // The same id on two kinds is two rows.
  assert.notEqual(savedKey({ type: 'note', contentId: 3 }), savedKey({ type: 'statute', contentId: 3 }));
  assert.deepEqual(savedItem('folder:7'), { type: 'folder', id: 7 });
  assert.deepEqual(savedItem(savedKey({ type: 'case', contentId: 120 })), { type: 'case', id: 120 });
});

test('Remove from Saved asks first with the count, then sends one bulk request', () => {
  const bulk = read('bookmarks-bulk.tsx');
  assert.match(bulk, /title=\{`Remove \$\{countOf\(select\.count, NOUN\)\} from Saved\?`\}/);
  assert.match(bulk, /bulkApi\.bookmarks\(ticked\.map\(savedItem\)\)/);
  // What the server took out leaves every Saved list, and a case's or statute's star turns off.
  assert.match(bulk, /removeBookmarkFromLists\(queryClient, type, id\);/);
  assert.match(bulk, /if \(type === 'case'\) writeBookmarkEverywhere\(queryClient, id, false\);/);
  assert.match(bulk, /if \(type === 'statute'\) writeStatuteBookmarkEverywhere\(queryClient, id, false\);/);
  assert.match(read('..', '..', 'bulk', 'api.ts'), /post\('\/bulk\/bookmarks', \{ action: 'remove', items: batch \}\)/);
});

test('the ticks belong to the tab, and a ticked row steps its star aside', () => {
  const page = read('BookmarksBrowser.tsx');
  assert.match(page, /useBookmarksBulk\(\{ rows \}\)/);
  assert.match(page, /const setTab = \(next: BookmarkTab\) => \{\s*\/\/ [^\n]*\n\s*bulk\.stop\(\);/);
  assert.match(page, /onToggleSelect=\{selecting \? toggleRow : undefined\}/);
  const row = read('BookmarkRow.tsx');
  assert.match(row, /\{selecting \? \(\s*<label[\s\S]*?<Checkbox/);
  assert.match(row, /\{selecting \? \(\s*<span aria-hidden className="mt-3\.5 size-9 shrink-0" \/>\s*\) : \(\s*<UnsaveButton/);
});
