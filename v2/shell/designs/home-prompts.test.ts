import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { promptText } from './home-prompt-text';

/* Tester, 20 October 2026 (finding 19): a tapped suggestion put "Find a case
 * on" in the box with no space, so the typed word ran on. */

test('a tapped prompt leaves one space after the stub', () => {
  assert.equal(promptText('Find a case on'), 'Find a case on ');
  assert.equal(`${promptText('Find a case on')}tenancy`, 'Find a case on tenancy');
});

test('both presentations insert promptText, never the bare label', () => {
  const source = readFileSync(join(process.cwd(), 'v2', 'shell', 'designs', 'HomePrompts.tsx'), 'utf8');
  assert.equal((source.match(/onClick=\{\(\) => onSelect\(promptText\(label\)\)\}/g) ?? []).length, 2);
  assert.doesNotMatch(source, /onSelect\(label\)/);
});

test("the chat tab's third prompt is Draft a document, with a document-and-pen icon", () => {
  const source = readFileSync(join(process.cwd(), 'v2', 'shell', 'designs', 'HomePrompts.tsx'), 'utf8');
  assert.match(source, /\{ label: 'Draft a document', icon: FilePen \},/);
  // Arthur, 25 October 2026: in place of "Do I have rights to".
  assert.doesNotMatch(source, /label: 'Do I have rights to'|ShieldQuestion/);
  // The other three chat prompts stay.
  for (const label of ['Explain this law', 'Find a case on', 'Connect me to a lawyer']) assert.ok(source.includes(`label: '${label}'`), label);
});
