import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { chainSummaryLabel } from './chain-summary';

/* Tester, 20 October 2026 (finding 5): "3 tool calls completed" above a chain
 * that opened to 4 finished steps. */

const done = { toolStatus: 'complete' as const };
const running = { toolStatus: 'calling' as const };

test('the summary counts every finished step, the newest one included', () => {
  assert.equal(chainSummaryLabel([done, done, done, done]), '4 tool calls completed');
});

test('a step still running is not counted as completed', () => {
  assert.equal(chainSummaryLabel([done, done, running]), '2 tool calls completed');
  assert.equal(chainSummaryLabel([done, running]), '1 tool call completed');
});

test('the folded chain shows the summary, not the count of hidden steps', () => {
  const chain = readFileSync(
    join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'tools', 'CompactToolChain.tsx'),
    'utf8',
  );
  assert.match(chain, /\{showAll \? 'Collapse steps' : chainSummaryLabel\(messages\)\}/);
  assert.doesNotMatch(chain, /hiddenCount/);
});
