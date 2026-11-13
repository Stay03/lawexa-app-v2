import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diffBlocks } from './block-diff';
import { diffLines } from './line-diff';

/* A skill's steps compared by markdown block, for the formatted view (Stay,
 * 13 November 2026, 2b436b4f). TEST DATA only. */

const BEFORE = [
  '# TEST DATA CAC annual returns',
  '',
  'Speak to the filer.',
  '',
  '## Step 1',
  '',
  '- Open the dashboard.',
  '- Read the status line.',
  '',
  '| Company | Form |',
  '| --- | --- |',
  '| Small | Declaration |',
].join('\n');

test('an unchanged block stays one block, and a changed paragraph is one removed and one added block', () => {
  const after = BEFORE.replace('Speak to the filer.', 'Speak to the filer: a lawyer or the company officer.');
  assert.deepEqual(diffBlocks(BEFORE, after), [
    { kind: 'same', text: '# TEST DATA CAC annual returns' },
    { kind: 'removed', text: 'Speak to the filer.' },
    { kind: 'added', text: 'Speak to the filer: a lawyer or the company officer.' },
    { kind: 'same', text: '## Step 1' },
    { kind: 'same', text: '- Open the dashboard.\n- Read the status line.' },
    { kind: 'same', text: '| Company | Form |\n| --- | --- |\n| Small | Declaration |' },
  ]);
});

test('a list and a table are compared whole, so each renders as formatted text on its own', () => {
  const after = BEFORE.replace('- Read the status line.', '- Read the status line.\n- Note the missing years.');
  const diff = diffBlocks(BEFORE, after);
  assert.deepEqual(diff.filter((block) => block.kind !== 'same'), [
    { kind: 'removed', text: '- Open the dashboard.\n- Read the status line.' },
    { kind: 'added', text: '- Open the dashboard.\n- Read the status line.\n- Note the missing years.' },
  ]);
});

test('a fenced block with blank lines inside stays one block', () => {
  const fenced = 'Intro.\n\n```\nline one\n\nline two\n```\n\nEnd.';
  assert.deepEqual(diffBlocks('', fenced).map((block) => block.text), ['Intro.', '```\nline one\n\nline two\n```', 'End.']);
});

test('spacing and line endings alone are no change; an empty side is all added or all removed', () => {
  assert.ok(diffBlocks(BEFORE, `\n\n${BEFORE.replace(/\n/g, '\r\n')}\n\n`).every((block) => block.kind === 'same'));
  assert.ok(diffBlocks('', BEFORE).every((block) => block.kind === 'added'));
  assert.ok(diffBlocks(BEFORE, '').every((block) => block.kind === 'removed'));
  assert.deepEqual(diffBlocks('', ''), []);
});

test('the line diff behind "Show raw text" is unchanged', () => {
  assert.deepEqual(diffLines('a\nb', 'a\nc'), [
    { kind: 'same', text: 'a' },
    { kind: 'removed', text: 'b' },
    { kind: 'added', text: 'c' },
  ]);
});

test('in a run of changes, each old part is followed by the part that replaced it', () => {
  const before = 'Keep.\n\nOld one.\n\nOld two.\n\nEnd.';
  const after = 'Keep.\n\nNew one.\n\nNew two.\n\nNew three.\n\nEnd.';
  assert.deepEqual(diffBlocks(before, after), [
    { kind: 'same', text: 'Keep.' },
    { kind: 'removed', text: 'Old one.' },
    { kind: 'added', text: 'New one.' },
    { kind: 'removed', text: 'Old two.' },
    { kind: 'added', text: 'New two.' },
    { kind: 'added', text: 'New three.' },
    { kind: 'same', text: 'End.' },
  ]);
});
