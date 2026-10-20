import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MAX_TAGS, cleanSuggestions, isSuggested, shownTags, wantsSuggestions } from './publish-tags';

/* Arthur, 20 October 2026, 19:58Z: the publish step suggests tags for a note
 * with none (backend 0084b71c). The chips arrive marked as suggestions, the
 * writer keeps, removes or adds, and Publish sends what is on screen. */

test('suggestions are trimmed, cut to 50 characters, and kept once in any case', () => {
  const long = 'x'.repeat(60);
  assert.deepEqual(cleanSuggestions([' Tenancy Law ', 'tenancy law', '', 'Self-help', long, 7, null]), [
    'Tenancy Law',
    'Self-help',
    'x'.repeat(50),
  ]);
  assert.deepEqual(cleanSuggestions(undefined), []);
  assert.equal(cleanSuggestions(Array.from({ length: 14 }, (_, i) => `Tag ${i}`)).length, MAX_TAGS);
});

test('the box shows saved tags first, then suggestions, and the writer’s own list once they change one', () => {
  const suggestions = ['Tenancy Law', 'Notice to quit'];
  assert.deepEqual(shownTags(null, [], suggestions), suggestions);
  assert.deepEqual(shownTags(null, ['Contract'], suggestions), ['Contract']);
  // After a change, a late answer never adds chips under the writer's hands.
  assert.deepEqual(shownTags(['Mine'], [], suggestions), ['Mine']);
  assert.deepEqual(shownTags([], [], suggestions), []);
});

test('a chip is a suggestion when the server named it, in any case', () => {
  assert.equal(isSuggested('tenancy law', ['Tenancy Law']), true);
  assert.equal(isSuggested('Contract', ['Tenancy Law']), false);
});

test('only an open sheet on a note with no tags asks the server', () => {
  assert.equal(wantsSuggestions(true, []), true);
  assert.equal(wantsSuggestions(false, []), false);
  assert.equal(wantsSuggestions(true, ['Contract']), false);
});

const sheet = readFileSync(join(process.cwd(), 'v2', 'features', 'notes', 'editor', 'PublishSheet.tsx'), 'utf8');
const queries = readFileSync(join(process.cwd(), 'v2', 'features', 'notes', 'queries.ts'), 'utf8');

test('Publish sends the tags on screen, suggestions included, through the same save', () => {
  assert.match(sheet, /const tags = shownTags\(current\.tags, savedTags, suggestions\);/);
  assert.match(sheet, /tags: sent \};/);
  assert.match(sheet, /enabled: wantsSuggestions\(open, savedTags\)/);
});

test('the suggestion read asks once per saved version, never retries, and is never kept on the device', () => {
  const leaf = queries.slice(queries.indexOf('suggestedTags:'));
  assert.match(leaf, /queryKey: \[\.\.\.notesQueries\.all, 'suggested-tags', id, updatedAt\]/);
  assert.match(leaf, /retry: false/);
  assert.match(leaf, /staleTime: Infinity/);
  assert.doesNotMatch(leaf, /persist/);
});
