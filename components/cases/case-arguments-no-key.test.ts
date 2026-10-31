import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { authorityKey, authorityLabel } from './case-argument-authority';

/* The public case payload carries no reporter key (Stay's A, thread
 * b74f2724): the server drops `nwlr_key` from the case, its cited cases and
 * its argument authorities, and fills `display_title` from the citation's own
 * words. The page reads the title alone. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

test('an authority with no title shows nothing, and its row still has a key', () => {
  assert.equal(authorityLabel({ display_title: null }), null);
  assert.equal(authorityLabel({ display_title: '   ' }), null);
  assert.equal(authorityLabel({ display_title: 'TEST DATA v Landlord' }), 'TEST DATA v Landlord');
  // A linked row keys by its case, an unlinked one by its place; two rows never share a key.
  assert.equal(authorityKey({ cited_case_id: 7 }, 0), '7-0');
  assert.equal(authorityKey({ cited_case_id: null }, 1), 'unlinked-1');
  assert.notEqual(authorityKey({ cited_case_id: 7 }, 0), authorityKey({ cited_case_id: 7 }, 2));
  // The row renders nothing for a missing label rather than an empty link.
  const section = read('components', 'cases', 'CaseArgumentsSection.tsx');
  assert.match(section, /const label = authorityLabel\(authority\);\s*if \(!label\) return null;/);
});

test('the page holds no reporter key anywhere it reads a case', () => {
  assert.doesNotMatch(read('components', 'cases', 'CaseArgumentsSection.tsx'), /nwlr_key/);
  assert.doesNotMatch(read('types', 'case.ts'), /nwlr_key/);
});
