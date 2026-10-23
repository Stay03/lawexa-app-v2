import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Stay, via Lucy, 23 October 2026: a Space with files and no folders showed
 * "No folders in this space yet" (New folder, Upload files, Invite people)
 * above its files. The empty state is for a Space with neither. */

const here = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(here, 'detail', 'content', 'SpaceContentPanel.tsx'), 'utf8').replace(/\r\n/g, '\n');

test('the Folders pill counts its files in no folder, so files alone are not "empty"', () => {
  // The panel's one read of the loose files, handed to the feed; null while it loads.
  assert.match(panel, /looseFileCount=\{tab === 'folders' && !looseQuery\.isPending \? files\.length : null\}/);
  assert.match(panel, /tab === 'folders' && loosePages \? uniqueRowsById\(loosePages, \(file\) => file\.id\) : NO_FILES/);
  assert.match(panel, /count=\{items\.length \+ \(looseFileCount \?\? 0\)\}/);
});

test('while the files are still loading the Folders pill shows no empty state', () => {
  assert.match(panel, /empty=\{\n\s+tab === 'folders' && looseFileCount === null \? null : \(\n\s+<SpaceContentEmptyState/);
});
