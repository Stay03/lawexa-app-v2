import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseProvisionSegment } from './provision';

/* Other spellings of a section's address are forwarded to it (Stay, 16
 * October 2026: Lawexa's link `.../sec-49` opened the statute at the top).
 * The rule is a `next.config` redirect, a real 308 before any render. */

const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');

test('next.config forwards sec-, s-, art- and article- to the section- address', () => {
  assert.match(
    config,
    /source:\s*'\/statutes\/:slug\/:spelling\(sec\|s\|art\|article\)-:num\(\\\\d\+\[a-zA-Z\]\*\(\?:-\\\\d\+\[a-zA-Z\]\*\)\?\)',\s*destination: '\/statutes\/:slug\/section-:num',\s*permanent: true,/,
  );
});

test('the rule matches the spellings it should, and only those', () => {
  // The rule's own pattern, as path-to-regexp reads it for this one segment.
  const segment = /^(sec|s|art|article)-(\d+[a-zA-Z]*(?:-\d+[a-zA-Z]*)?)$/;
  const forward = (spelling: string) => {
    const match = segment.exec(spelling);
    return match ? `section-${match[2]}` : null;
  };
  assert.equal(forward('sec-49'), 'section-49');
  assert.equal(forward('s-49'), 'section-49');
  assert.equal(forward('art-12'), 'section-12');
  assert.equal(forward('article-12'), 'section-12');
  assert.equal(forward('sec-54a'), 'section-54a');
  assert.equal(forward('sec-54-2'), 'section-54-2');
  for (const spelling of ['section-49', 'part-i', 'sec-', 'sec-a', 'sec-54-2-1', 'sector-4']) {
    assert.equal(forward(spelling), null, spelling);
  }
  // Every forward lands on an address the reader's grammar reads.
  for (const spelling of ['sec-49', 's-7', 'art-12', 'article-3b', 'sec-54-2']) {
    assert.notEqual(parseProvisionSegment(forward(spelling) ?? ''), null, spelling);
  }
});

test('the route does no forwarding of its own', () => {
  const page = readFileSync(
    join(process.cwd(), 'app', 'v2', 'statutes', '[slug]', '[[...provision]]', 'page.tsx'),
    'utf8',
  );
  assert.doesNotMatch(page, /permanentRedirect|canonicalProvisionSegment/);
});
