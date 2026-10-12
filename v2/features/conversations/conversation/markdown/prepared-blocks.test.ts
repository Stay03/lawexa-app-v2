import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREPARED_CHARS_CAP, createPreparedBlocks } from './prepared-blocks';

test('a kept value comes back for its text, and nothing for another', () => {
  const kept = createPreparedBlocks<string>(100);
  kept.set('alpha', 'A');
  assert.equal(kept.get('alpha'), 'A');
  assert.equal(kept.get('beta'), undefined);
  assert.equal(kept.has('alpha'), true);
  assert.equal(kept.has('beta'), false);
  assert.equal(kept.size, 1);
  assert.equal(kept.chars, 5);
});

test('past the cap in characters, the least recently used entries go first', () => {
  const kept = createPreparedBlocks<number>(10);
  kept.set('aaaa', 1);
  kept.set('bbbb', 2);
  assert.equal(kept.chars, 8);
  kept.set('ccc', 3);
  assert.equal(kept.has('aaaa'), false, 'the oldest went');
  assert.equal(kept.has('bbbb'), true);
  assert.equal(kept.has('ccc'), true);
  assert.equal(kept.chars, 7);
  assert.equal(kept.size, 2);
});

test('a read is a use: the entry read last is the last to go', () => {
  const kept = createPreparedBlocks<number>(10);
  kept.set('aaaa', 1);
  kept.set('bbbb', 2);
  assert.equal(kept.get('aaaa'), 1);
  kept.set('ccc', 3);
  assert.equal(kept.has('aaaa'), true);
  assert.equal(kept.has('bbbb'), false);
});

test('a check is not a use', () => {
  const kept = createPreparedBlocks<number>(10);
  kept.set('aaaa', 1);
  kept.set('bbbb', 2);
  kept.has('aaaa');
  kept.set('ccc', 3);
  assert.equal(kept.has('aaaa'), false);
});

test('a text longer than the cap is not kept and drops nothing', () => {
  const kept = createPreparedBlocks<number>(10);
  kept.set('aaaa', 1);
  kept.set('x'.repeat(11), 2);
  assert.equal(kept.has('x'.repeat(11)), false);
  assert.equal(kept.has('aaaa'), true);
  assert.equal(kept.chars, 4);
});

test('keeping a text again replaces its value and counts it once', () => {
  const kept = createPreparedBlocks<number>(10);
  kept.set('aaaa', 1);
  kept.set('aaaa', 2);
  assert.equal(kept.get('aaaa'), 2);
  assert.equal(kept.size, 1);
  assert.equal(kept.chars, 4);
});

test('several entries go in one keep when one long text needs the room', () => {
  const kept = createPreparedBlocks<number>(10);
  kept.set('aa', 1);
  kept.set('bb', 2);
  kept.set('cc', 3);
  kept.set('ddddddd', 4);
  assert.deepEqual(['aa', 'bb', 'cc', 'ddddddd'].map((text) => kept.has(text)), [false, false, true, true]);
  assert.equal(kept.chars, 9);
});

test('the cap covers a few long chats', () => {
  assert.equal(PREPARED_CHARS_CAP, 200_000);
});

// Rendering cannot run under node:test. These pin how MarkdownText uses the
// cache: only the plain pipeline's output is kept, read before any parse, and
// an answer whose blocks are all kept defers none of them.
const here = dirname(fileURLToPath(import.meta.url));
const markdownText = readFileSync(join(here, 'MarkdownText.tsx'), 'utf8');

test('MarkdownText parses a block by calling react-markdown as a function, so the result can be kept', () => {
  assert.match(markdownText, /import Markdown, \{ type Components, type Options \} from 'react-markdown';/);
  assert.match(
    markdownText,
    /return Markdown\(\{\s*children: content,\s*remarkPlugins: REMARK_PLUGINS,\s*rehypePlugins,\s*components: MARKDOWN_COMPONENTS,\s*\}\);/,
  );
  assert.doesNotMatch(markdownText, /<Markdown[\s>]/);
  assert.doesNotMatch(markdownText, /<ReactMarkdown/);
});

test('MarkdownText keeps only the plain pipeline\'s output, and reads it before parsing', () => {
  assert.match(markdownText, /const preparedBlocks = createPreparedBlocks<ReactElement>\(PREPARED_CHARS_CAP\);/);
  assert.match(markdownText, /if \(animate\) return parseBlock\(content, REHYPE_ANIMATED\);/);
  assert.match(
    markdownText,
    /const kept = preparedBlocks\.get\(content\);\s*if \(kept\) return kept;\s*const parsed = parseBlock\(content, REHYPE_PLAIN\);[\s\S]*?preparedBlocks\.set\(content, parsed\);\s*return parsed;/,
  );
});

test('an answer whose blocks are all kept defers none of them on an open', () => {
  assert.match(
    markdownText,
    /eagerFrom:\s*keep && !blocks\.every\(\(block\) => preparedBlocks\.has\(block\)\)\s*\? eagerStart\(blocks, \{ streaming: animate \|\| content === '', landsAtBottom: keep\.landsAtBottom \}\)\s*: 0,/,
  );
});
