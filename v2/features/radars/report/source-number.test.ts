import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sourceNumber } from './source-number';

/* A report's sources count from one, as its prose cites them (26 October
 * 2026): the API stores positions from 0, and the list showed "0, 1, 2". */

test('the first source is 1, and a gap in the positions stays a gap', () => {
  assert.equal(sourceNumber(0), 1);
  assert.deepEqual([0, 1, 3].map(sourceNumber), [1, 2, 4]);
});

test('the sources list prints that number, in position order', () => {
  const list = readFileSync(join(process.cwd(), 'v2', 'features', 'radars', 'report', 'ReportSources.tsx'), 'utf8');
  assert.match(list, /\{sourceNumber\(source\.position\)\}/);
  assert.match(list, /const ordered = \[\.\.\.sources\]\.sort\(\(a, b\) => a\.position - b\.position\);/);
  assert.doesNotMatch(list, />\s*\{source\.position\}\s*</);
});
