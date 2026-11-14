import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { shareData } from './share-data';

/* A shared link that arrived with the share message glued onto it (Arthur's
 * live quiz test, 14 November 2026). TEST DATA only. */

const RESULTS = 'https://lawexa.test/quiz-results/8eb6bdc0-3cbc-478c-ac89-6343a73bb582';
const INVITE = 'https://lawexa.test/join/HLUEoNpFPPtpXzcP';

test('a sentence and a link go as one text, the link on its own line, with no url field to glue onto', () => {
  const data = shareData({ title: 'TEST DATA quiz', text: 'Arthur is the one to beat.', url: RESULTS });
  assert.deepEqual(data, { title: 'TEST DATA quiz', text: `Arthur is the one to beat.\n${RESULTS}` });
  assert.equal('url' in data, false);
});

test('the link line is the bare address, whatever the sentence holds', () => {
  const sentence = 'Join my live quiz “Law of Contract — Offer & Acceptance” on Lawexa.';
  const data = shareData({ title: null, text: sentence, url: INVITE });
  const lines = (data.text ?? '').split('\n');
  assert.equal(lines.at(-1), INVITE);
  // A linkifier stops at whitespace: what it finds on that line is the link alone.
  assert.deepEqual((data.text ?? '').match(/https?:\/\/\S+/g), [INVITE]);
});

test('with no sentence the link goes as the url the sheet expects', () => {
  assert.deepEqual(shareData({ title: 'TEST DATA note', url: RESULTS }), { title: 'TEST DATA note', url: RESULTS });
  assert.deepEqual(shareData({ text: '   ', url: RESULTS }), { url: RESULTS });
});

test('no share sheet call hands over a sentence and a link as two fields', () => {
  const files = execFileSync('git', ['ls-files', 'v2/**/*.ts', 'v2/**/*.tsx', 'components/**/*.tsx', 'app/**/*.tsx'], { encoding: 'utf8' })
    .split('\n')
    .filter((file) => file && !file.endsWith('.test.ts'));
  const calls: { file: string; argument: string }[] = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    // `navigator.share(` and `navigator` broken over a line before `.share(`; the argument up to its first `)`.
    for (const match of source.matchAll(/navigator\s*\.\s*share\(([^)]*)/g)) calls.push({ file, argument: match[1] });
  }
  assert.ok(calls.length >= 6, `found ${calls.length} share calls`);
  const split = calls.filter(
    ({ argument }) => /\btext\s*:/.test(argument) && /\burl\s*[:,}]/.test(argument) && !/shareData\(/.test(argument),
  );
  assert.deepEqual(split.map(({ file }) => file), [], 'shareData puts the two in one text');
});
