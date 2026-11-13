import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { draftsIn } from './draft-blocks';
import { markdownToDoc } from './markdown-to-doc';

/* Arthur's adjournment letter (13 November 2026, thread 83151a13; Arthur picked
 * A): Lawexa opened the draft and never closed it, so the panel read it as
 * unfinished and showed it as chat text: the right-aligned date as a typed tag
 * and the signature block as a code box. An unfinished draft, once the answer
 * has ended, is now drawn as the document a finished one is, read only.
 * TEST DATA in the shape of the live message (600241). */

const ANSWER = [
  'TEST DATA. Here is the application.',
  '',
  '<draft title="Application for Adjournment" id="adj001" version="1">',
  '<p style="text-align: right">[DATE OF LETTER]</p>',
  '',
  '**APPLICATION FOR ADJOURNMENT**',
  '',
  '1. TEST DATA. The applicant asks the court to adjourn the hearing.',
  '2. TEST DATA. Counsel is unwell.',
  '',
  '```signature',
  'Counsel for the Applicant | Date',
  '[NAME OF COUNSEL] | [DATE]',
  '```',
].join('\n');

test('a draft never closed reads as unfinished, with the right-aligned date and the signature table in its body', () => {
  const [draft] = draftsIn(ANSWER);
  assert.ok(draft, 'the draft is found');
  assert.equal(draft.complete, false);
  assert.equal(draft.title, 'Application for Adjournment');
  const nodes = markdownToDoc(draft.body).content ?? [];
  const date = nodes.find((node) => JSON.stringify(node).includes('[DATE OF LETTER]'));
  assert.equal(date?.attrs?.textAlign, 'right', 'the date is a right-aligned paragraph, not a typed tag');
  assert.ok(!JSON.stringify(nodes).includes('<p style'), 'no tag is left as text');
  const table = nodes.find((node) => node.type === 'table');
  assert.ok(table, 'the signature block is a table, not a code box');
  assert.ok(!nodes.some((node) => node.type === 'codeBlock'), 'no code box');
  // Numbered paragraphs keep their numbers with a hanging indent (legal-text.ts), as in a finished draft.
  assert.ok(nodes.filter((node) => node.attrs?.hang === 1).length === 2, 'the numbered paragraphs hang');
});

test('the panel draws an unfinished draft as the read-only document once the answer has ended, and streams it as text while it is written', () => {
  const panel = readFileSync(new URL('./DraftPanel.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(
    panel,
    /\{!draft\.complete && streamingMessage \? \(\s*<MarkdownText content=\{draft\.body\} animate \/>\s*\) : \(\s*<DraftDocument draft=\{draft\} \/>\s*\)\}/,
  );
  // The editor (edit, save, download, compare) stays for a finished draft only.
  assert.match(panel, /\{draft\.complete && conversationId \? \(\s*<DraftEditor/);
});
