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

test('the panel draws an unfinished draft as the read-only document, while it is written and after (Arthur, 18 November 2026)', () => {
  const panel = readFileSync(new URL('./DraftPanel.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  // One reader for a draft still being written and one that ended unfinished: the
  // chat's Markdown text showed a template's <p style="text-align: …"> lines as tags.
  assert.match(panel, /<article className=\{DRAFT_DOCUMENT\}>[\s\S]{0,900}?<DraftDocument draft=\{draft\} \/>\s*<\/article>/);
  assert.doesNotMatch(panel, /MarkdownText/);
  // The editor (edit, save, download, compare) stays for a finished draft only.
  assert.match(panel, /\{draft\.complete && conversationId \? \(\s*<DraftEditor/);
});

/* Arthur's garnishee draft (18 November 2026, thread 83151a13): a template's
 * aligned lines, written run together as the server's layout rule writes them,
 * showed as typed tags while the draft was still streaming. The document reader
 * now draws it at every point of the stream. TEST DATA in the shape of that answer. */
const GARNISHEE = [
  'TEST DATA. Here is the bundle.',
  '',
  '<draft title="Garnishee Order Nisi" id="gar001" version="1">',
  '<p style="text-align: center"><strong>IN THE HIGH COURT OF LAGOS STATE</strong></p><p style="text-align: center"><strong>HOLDEN AT [JUDICIAL DIVISION]</strong></p><p style="text-align: right">SUIT NO: [SUIT NUMBER]</p>',
  '**BETWEEN:**',
  '',
  '[PARTY A] ............ CLAIMANT/JUDGMENT CREDITOR',
  '',
  '<p style="text-align: center">AND</p>',
  '',
  '[PARTY B] ............ DEFENDANT/JUDGMENT DEBTOR',
  '',
  '<p style="text-align: center"><strong>MOTION EX PARTE</strong></p><p style="text-align: justify">TAKE NOTICE that this Honourable Court will be moved on the [DAY] day of [MONTH].</p>',
].join('\n');

test('a template draft read part way through its stream never shows a tag as text', () => {
  // Every cut a stream can make: mid-tag, mid-word, mid-line.
  for (let cut = GARNISHEE.indexOf('<p style'); cut <= GARNISHEE.length; cut += 7) {
    const [draft] = draftsIn(GARNISHEE.slice(0, cut), true);
    if (!draft) continue;
    const text = JSON.stringify(markdownToDoc(draft.body).content ?? []);
    assert.ok(!/<\/?(p|strong)\b/.test(text), `no tag as text at ${cut}: ${text.slice(0, 160)}`);
  }
  const [whole] = draftsIn(GARNISHEE, true);
  const nodes = markdownToDoc(whole.body).content ?? [];
  const court = nodes.find((node) => JSON.stringify(node).includes('IN THE HIGH COURT OF LAGOS STATE'));
  assert.equal(court?.attrs?.textAlign, 'center', 'the court line is centred');
  const notice = nodes.find((node) => JSON.stringify(node).includes('TAKE NOTICE'));
  assert.equal(notice?.attrs?.textAlign, 'justify');
});
