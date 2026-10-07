import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyText } from './copy-text';
import { DOCUMENT_FENCE_TAGS, fenceKind, fenceLanguage, looksLikeCode } from './fence-kind';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(join(here, name), 'utf8');

const COURT_TEMPLATE = `IN THE HIGH COURT OF JUSTICE OF LAGOS STATE
IN THE IKEJA JUDICIAL DIVISION
HOLDEN AT IKEJA

SUIT NO: ____________

BETWEEN:
ADEBAYO OLUWASEUN ............................ CLAIMANT/APPLICANT

AND

FIRST BANK OF NIGERIA PLC .................... DEFENDANT/RESPONDENT

MOTION ON NOTICE
(Brought pursuant to Order 43 Rule 1 of the High Court of Lagos State (Civil Procedure) Rules 2019)

TAKE NOTICE that this Honourable Court will be moved on the ____ day of ________ 20__,
at the hour of 9 o'clock in the forenoon or so soon thereafter as counsel may be heard,
for the following reliefs:

1. AN ORDER of interlocutory injunction restraining the Defendant from ...
2. AND for such further order(s) as this Honourable Court may deem fit to make.

Dated this ____ day of ________ 20__.

______________________
Counsel to the Claimant`;

const JS = `import { x } from 'y';
const total = items.reduce((a, b) => a + b, 0);
function run() {
  return total;
}`;

const PHP = `<?php
$user = User::find(1);
return response()->json($user);`;

const JSON_TEXT = `{
  "name": "Lawexa",
  "cases": 22069
}`;

test('the four document tags are no tag, text/plaintext/txt and md/markdown', () => {
  for (const tag of ['', 'text', 'plaintext', 'txt', 'md', 'markdown']) assert.equal(DOCUMENT_FENCE_TAGS.has(tag), true, tag);
  assert.equal(DOCUMENT_FENCE_TAGS.has('js'), false);
});

test('a court template fenced with no tag, text, plaintext or md renders as a document', () => {
  for (const tag of ['', 'text', 'plaintext', 'md']) assert.equal(fenceKind(tag, COURT_TEMPLATE), 'document', tag || '(no tag)');
  assert.equal(looksLikeCode(COURT_TEMPLATE), false);
});

test('a fence tagged with a programming language keeps the code look, whatever is inside', () => {
  for (const tag of ['js', 'javascript', 'ts', 'php', 'python', 'json', 'sql', 'bash']) {
    assert.equal(fenceKind(tag, COURT_TEMPLATE), 'code', tag);
  }
  assert.equal(fenceKind('php', PHP), 'code');
  assert.equal(fenceKind('json', JSON_TEXT), 'code');
});

test('code-shaped content with no tag (or text/md) keeps the code look', () => {
  assert.equal(fenceKind('', JS), 'code');
  assert.equal(fenceKind('text', PHP), 'code');
  assert.equal(fenceKind('', JSON_TEXT), 'code');
  assert.equal(fenceKind('md', '$ npm install\n$ npm run build'), 'code');
  assert.equal(fenceKind('', '<div class="x">\n  <p>Hi</p>\n</div>'), 'code');
  // Mostly symbols and numbers, few letters.
  assert.equal(fenceKind('', '1, 2, 3, 4\n5, 6, 7, 8\n9, 10, 11, 12'), 'code');
});

test('ordinary prose in a fence is a document; an empty fence is not code', () => {
  assert.equal(fenceKind('', 'Dear Sir,\nWe write on behalf of our client.\nYours faithfully,'), 'document');
  assert.equal(looksLikeCode('   \n  '), false);
});

test('the tag comes from the code element class, lowercased, as react-markdown passes it', () => {
  assert.equal(fenceLanguage(['language-JS']), 'js');
  assert.equal(fenceLanguage('hljs language-text'), 'text');
  assert.equal(fenceLanguage(undefined), '');
  assert.equal(fenceLanguage([]), '');
});

test('Copy confirms only a copy that happened', async () => {
  const written: string[] = [];
  assert.equal(await copyText('form', { writeText: async (t: string) => { written.push(t); } }), true);
  assert.deepEqual(written, ['form']);
  assert.equal(await copyText('form', { writeText: async () => { throw new Error('denied'); } }), false);
  assert.equal(await copyText('form', undefined), false);
});

test('the chat renders fences through FencedBlock, and the Copy button copies the whole document', () => {
  const markdown = read('MarkdownText.tsx');
  assert.match(markdown, /const MARKDOWN_COMPONENTS: Components = \{ a: CaseMentionLink, pre: FencedBlock \};/);
  // Code blocks stay readable in light mode: theme text on the muted background.
  assert.match(markdown, /\[&_pre\]:bg-muted \[&_pre\]:text-foreground/);
  const block = read('FencedBlock.tsx');
  assert.match(block, /if \(!code \|\| fenceKind\(language, text\) === 'code'\) return <pre \{\.\.\.rest\}>\{children\}<\/pre>;/);
  assert.match(block, /if \(!\(await copyText\(text\)\)\) return;/);
  // Theme tokens only, so light and dark both hold.
  assert.match(block, /border-border bg-card text-card-foreground/);
  assert.doesNotMatch(block, /#[0-9a-f]{3,6}\b|bg-white|bg-black|text-black|text-white/);
  // Wrapped lines that keep the AI's breaks and indents.
  assert.match(block, /whitespace-pre-wrap break-words/);
});
