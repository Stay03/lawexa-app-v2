import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* Speed step 6, part 2 (Stay, 17 October 2026): while an answer streams, only
 * its last two blocks fade their words in. A finished block parses once,
 * plain, and is kept, so it holds no word spans and the landing re-parses only
 * the tail. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('only the last two blocks of a streaming answer take the animated pipeline', () => {
  const source = read('v2', 'features', 'conversations', 'conversation', 'markdown', 'MarkdownText.tsx');
  assert.match(source, /const ANIMATED_TAIL_BLOCKS = 2;/);
  assert.match(
    source,
    /<MarkdownBlock\s+key=\{index\}\s+content=\{block\}\s+animate=\{animate && index >= blocks\.length - ANIMATED_TAIL_BLOCKS\}\s+\/>/,
  );
  // Every block still takes `animate` as a prop, so a block's memo breaks
  // exactly when it leaves the tail, and a landed answer keeps no spans.
  assert.doesNotMatch(source, /animate=\{animate\}/);
  // The plain parse is the one kept; the animated one never is.
  assert.match(source, /if \(animate\) return parseBlock\(content, REHYPE_ANIMATED\);/);
  assert.match(source, /preparedBlocks\.set\(content, parsed\);/);
});
