import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { QUOTE_MAX, quizSourceView } from './quiz-source';

/* Where a question or a scenario comes from (Stay, 24 October 2026: Lawexa
 * makes the quiz, its questions and their source). Shape from backend
 * (quiz-builder, 24 October 2026). */

const here = dirname(fileURLToPath(import.meta.url));

test('a Library item links to its page in the app, with its quote', () => {
  assert.deepEqual(
    quizSourceView({ kind: 'case', id: 12, title: 'TEST DATA Ojukwu v Lagos State', quote: 'A right of way is an easement.', url: '/cases/test-data-ojukwu-v-lagos-state' }),
    { label: 'Case', title: 'TEST DATA Ojukwu v Lagos State', href: '/cases/test-data-ojukwu-v-lagos-state', external: false, quote: 'A right of way is an easement.' },
  );
  assert.equal(quizSourceView({ kind: 'statute', title: 'TEST DATA Land Use Act', url: '/statutes/land-use-act' })?.label, 'Statute');
  assert.equal(quizSourceView({ kind: 'note', title: 'TEST DATA Easements notes', url: '/notes/easements' })?.href, '/notes/easements');
});

test('a web page links out as an outside source; its host stands in for a missing title', () => {
  const web = quizSourceView({ kind: 'web', title: 'TEST DATA Easements explained', url: 'https://example.org/easements' });
  assert.deepEqual(web, { label: 'Outside source', title: 'TEST DATA Easements explained', href: 'https://example.org/easements', external: true, quote: null });
  assert.equal(quizSourceView({ kind: 'web', title: null, url: 'https://www.example.org/a' })?.title, 'example.org');
});

test('a file has no page of its own, so it is named without a link; an address of the wrong kind is never a link', () => {
  assert.deepEqual(quizSourceView({ kind: 'file', id: 88, title: 'TEST DATA lease.pdf', url: null }), {
    label: 'File',
    title: 'TEST DATA lease.pdf',
    href: null,
    external: false,
    quote: null,
  });
  // A Library item with an outside address, or a web page with an app address: no link.
  assert.equal(quizSourceView({ kind: 'case', title: 'T', url: 'https://example.org' })?.href, null);
  assert.equal(quizSourceView({ kind: 'case', title: 'T', url: '//example.org' })?.href, null);
  assert.equal(quizSourceView({ kind: 'web', title: 'T', url: '/cases/x' })?.href, null);
  assert.equal(quizSourceView({ kind: 'web', title: 'T', url: 'javascript:alert(1)' })?.href, null);
});

test('no source, a hidden one (null), an unknown kind or a nameless one: no line', () => {
  assert.equal(quizSourceView(null), null);
  assert.equal(quizSourceView(undefined), null);
  assert.equal(quizSourceView({ kind: 'case', title: '  ', url: '/cases/x' }), null);
  assert.equal(quizSourceView({ kind: 'podcast', title: 'T' } as never), null);
});

test('a long quote is cut to an excerpt, in one line', () => {
  const quote = quizSourceView({ kind: 'case', title: 'T', quote: `${'word '.repeat(80)}\n\nend`, url: '/cases/x' })?.quote ?? '';
  assert.ok(quote.length <= QUOTE_MAX, String(quote.length));
  assert.ok(quote.endsWith('…'));
  assert.doesNotMatch(quote, /\n/);
});

test('the line is drawn where the answers and the scenarios are, and in the author’s form', () => {
  const read = (path: string) => readFileSync(join(here, '..', '..', '..', path), 'utf8');
  const answers = read('features/quiz/solo/results/AnswersStepper.tsx');
  assert.match(answers, /<QuizSourceLine source=\{scenario\.source\} className="mt-2" \/>/);
  assert.match(answers, /<QuizSourceLine source=\{question\.source\} className="mt-3" \/>/);
  assert.match(read('features/quiz/solo/player/AttemptPlay.tsx'), /<QuizSourceLine source=\{scenario\.source\} className="mt-2" \/>/);
  assert.match(read('features/quiz/solo/front/QuizFrontScreen.tsx'), /<QuizSourceLine source=\{line\.source\} className="mt-1" \/>/);
  const form = read('features/channels/quiz/QuizFormDialog.tsx');
  assert.equal(form.match(/<QuizSourceLine source=\{draft\.source\} \/>/g)?.length, 2);
  // Plain text and a link: no chip, no gold.
  const line = readFileSync(join(here, 'QuizSourceLine.tsx'), 'utf8');
  assert.doesNotMatch(line, /bg-primary|text-primary|rounded-full|Badge/);
});
