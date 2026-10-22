import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The publish box opens on "Only you" for a note's first publish (Stay, 22
 * October 2026: "Only you as default"). The server creates every note public,
 * so reading the record alone would open a draft on "Anyone". A published note
 * opens on what it is, so an update never flips who can read it. */

const sheet = readFileSync(join(process.cwd(), 'v2', 'features', 'notes', 'editor', 'PublishSheet.tsx'), 'utf8');

test('a first publish opens on "Only you"; a published note keeps its own choice', () => {
  assert.match(sheet, /isPublic: record\.status === 'published' && record\.is_private === false,/);
  assert.doesNotMatch(sheet, /isPublic: record\.is_private === false,/);
  // The choice is still sent as the writer leaves it.
  assert.match(sheet, /is_private: !current\.isPublic/);
});
