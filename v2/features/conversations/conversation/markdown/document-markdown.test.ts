import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import { DOCUMENT_COMPONENTS, DOCUMENT_REMARK_PLUGINS, documentMarkdown } from './document-markdown';

/** The block's body exactly as the screen renders it. */
const render = (text: string) =>
  renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: DOCUMENT_REMARK_PLUGINS, components: DOCUMENT_COMPONENTS }, documentMarkdown(text)),
  );

/**
 * The two sample blocks the screen and the Word export share (techlead
 * c723861a). The API's tests use the same two texts.
 */
export const PLAIN_COURT_FORM = [
  'IN THE HIGH COURT OF JUSTICE OF LAGOS STATE',
  'IN THE IKEJA JUDICIAL DIVISION',
  'HOLDEN AT IKEJA',
  '',
  'SUIT NO: ____________',
  '',
  'BETWEEN:',
  'ADEBAYO OLUWASEUN ............ CLAIMANT/APPLICANT',
  '    AND',
  'FIRST BANK OF NIGERIA PLC .... DEFENDANT/RESPONDENT',
  '',
  'TAKE NOTICE that this Honourable Court will be moved on the ____ day of ________ 20__.',
  '',
  '______________________',
  'Counsel to the Claimant',
].join('\n');

export const MARKDOWN_COURT_FORM = [
  '# MOTION ON NOTICE',
  '',
  '**TAKE NOTICE** that the Claimant will apply for:',
  '',
  '1. An order of *interlocutory injunction*;',
  '2. Such further orders as the Court may deem fit.',
  '',
  '## Grounds',
  '',
  '- The Defendant debited the account without consent.',
  '  - On 3 March 2026.',
].join('\n');

test('a court form with no markdown keeps every line, space and rule as typed', () => {
  const html = render(PLAIN_COURT_FORM);
  assert.doesNotMatch(html, /<(h\d|hr|pre|code|ul|ol|em|strong)\b/, 'no markdown structure appears');
  assert.match(html, /IN THE HIGH COURT OF JUSTICE OF LAGOS STATE<br\/>\s*IN THE IKEJA JUDICIAL DIVISION<br\/>/);
  assert.match(html, /SUIT NO: ____________/);
  assert.match(html, / {4}AND/, 'the indent before AND stays');
  assert.match(html, /20__\./);
  assert.match(html, /______________________<br\/>\s*Counsel to the Claimant/, 'the signature line stays a line of underscores');
});

test('a court form with headings, bold, lists and a nested list renders them', () => {
  const html = render(MARKDOWN_COURT_FORM);
  assert.match(html, /<h2>MOTION ON NOTICE<\/h2>/, '# becomes the top heading inside the body');
  assert.match(html, /<h2>Grounds<\/h2>/);
  assert.match(html, /<strong>TAKE NOTICE<\/strong>/);
  assert.match(html, /<ol>[\s\S]*<em>interlocutory injunction<\/em>[\s\S]*<\/ol>/);
  assert.match(html, /<ul>\s*<li>The Defendant debited[\s\S]*<ul>\s*<li>On 3 March 2026\.<\/li>/, 'the indented item nests');
});

test('raw HTML prints as typed and an image shows only its alt text', () => {
  const html = render('<b>bold?</b> <script>alert(1)</script>\n\n![Exhibit A](https://example.com/a.png)');
  assert.doesNotMatch(html, /<b>|<script>|<img/);
  assert.match(html, /&lt;b&gt;bold\?&lt;\/b&gt;/);
  assert.match(html, /<span>Exhibit A<\/span>/);
});

test('an indented line never becomes a code block, and divider lines of any mark stay text', () => {
  assert.doesNotMatch(render('Intro\n\n        eight spaces in'), /<pre|<code/);
  for (const line of ['---', '***', '===', '_ _ _', '  ----------']) {
    assert.doesNotMatch(render(`Title\n${line}\nBody`), /<hr|<h\d/, `"${line}"`);
  }
});

test('the rewrite only touches leading spaces and divider lines', () => {
  assert.equal(documentMarkdown('  - item\n  > quote\n  # heading'), '  - item\n  > quote\n  # heading');
  assert.equal(documentMarkdown('\tTabbed'), '    Tabbed');
  assert.equal(documentMarkdown('_____'), '\\_____');
  assert.equal(documentMarkdown('plain *line*'), 'plain *line*');
});

test("the header title drops the first line's markdown marks but keeps a form's blanks", async () => {
  const { documentTitle } = await import('./document-view');
  assert.equal(documentTitle(MARKDOWN_COURT_FORM), 'MOTION ON NOTICE');
  assert.equal(documentTitle('**NOTICE OF APPEAL** to the `Court`'), 'NOTICE OF APPEAL to the Court');
  assert.equal(documentTitle(PLAIN_COURT_FORM), 'IN THE HIGH COURT OF JUSTICE OF LAGOS STATE');
  assert.equal(documentTitle('SUIT NO: ____ of 20__'), 'SUIT NO: ____ of 20__');
});
