import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { canonicalProvisionSegment, parseProvisionSegment } from './provision';

/* Other spellings of a section's address are forwarded to it (Stay, 16
 * October 2026: Lawexa's link `.../sec-49` opened the statute at the top). */

test('sec-, s-, art- and article- name the section- address they mean', () => {
  assert.equal(canonicalProvisionSegment('sec-49'), 'section-49');
  assert.equal(canonicalProvisionSegment('SEC-49'), 'section-49');
  assert.equal(canonicalProvisionSegment('s-49'), 'section-49');
  assert.equal(canonicalProvisionSegment('art-12'), 'section-12');
  assert.equal(canonicalProvisionSegment('article-12'), 'section-12');
  assert.equal(canonicalProvisionSegment('sec-54a'), 'section-54a');
  assert.equal(canonicalProvisionSegment('sec-54-2'), 'section-54-2');
  // Every forward lands on an address the grammar reads.
  for (const alias of ['sec-49', 's-7', 'art-12', 'article-3b', 'sec-54-2']) {
    assert.notEqual(parseProvisionSegment(canonicalProvisionSegment(alias) ?? ''), null, alias);
  }
});

test('the address itself and anything else are not forwarded', () => {
  assert.equal(canonicalProvisionSegment('section-49'), null);
  assert.equal(canonicalProvisionSegment('part-i'), null);
  assert.equal(canonicalProvisionSegment('sec-'), null);
  assert.equal(canonicalProvisionSegment('sec-a'), null);
  assert.equal(canonicalProvisionSegment('sec-54-2-1'), null);
  assert.equal(canonicalProvisionSegment('sector-4'), null);
});

test('the route forwards a spelling to its address before the reader draws', () => {
  const page = readFileSync(
    join(process.cwd(), 'app', 'v2', 'statutes', '[slug]', '[[...provision]]', 'page.tsx'),
    'utf8',
  );
  assert.match(
    page,
    /const canonical = provision\?\.\[0\] \? canonicalProvisionSegment\(provision\[0\]\) : null;\s*if \(canonical\) permanentRedirect\(`\/statutes\/\$\{slug\}\/\$\{canonical\}`\);\s*return <StatuteScreen/,
  );
});
