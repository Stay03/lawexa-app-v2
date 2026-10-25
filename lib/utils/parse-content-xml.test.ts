import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContent, type ContentSegment } from './parse-content-xml';

/* Expert answers, 25 October 2026: an answer showed the raw tags
 * "<execution_plan> (Already output earlier in this conversation.)
 * </execution_plan>". A plan block with no fields was never matched, so its
 * text fell through to the markdown. Every plan block is now cut out of the
 * text. One with fields draws the plan card; one with only a line of text draws
 * the card's compact form with that line as its note (Stay, 26 October 2026:
 * "Show note in plan card"); an empty one draws nothing. */

const here = dirname(fileURLToPath(import.meta.url));

const PLACEHOLDERS = ['(Already output earlier in this conversation.)', '(Output above, before any tool call.)'];

const texts = (segments: ContentSegment[]) =>
  segments.flatMap((segment) => (segment.type === 'text' ? [segment.content] : []));

for (const placeholder of PLACEHOLDERS) {
  test(`a plan block holding only "${placeholder}" draws the compact plan card with that note, no raw tags`, () => {
    const { segments } = parseContent(
      `TEST DATA. Here is the answer.\n\n<execution_plan>\n${placeholder}\n</execution_plan>\n\nThe tenant may recover the deposit.`,
    );
    assert.deepEqual(segments, [
      { type: 'text', content: 'TEST DATA. Here is the answer.' },
      { type: 'execution_plan', plan: { note: placeholder } },
      { type: 'text', content: 'The tenant may recover the deposit.' },
    ]);
    for (const text of texts(segments)) assert.doesNotMatch(text, /execution_plan/);
  });
}

test('an empty plan block draws nothing, and an answer that is only one shows nothing', () => {
  assert.deepEqual(parseContent('<execution_plan>\n  \n</execution_plan>').segments, []);
  assert.deepEqual(parseContent('Intro.\n<execution_plan></execution_plan>\nAnswer.').segments, [
    { type: 'text', content: 'Intro.' },
    { type: 'text', content: 'Answer.' },
  ]);
});

test('a plan block with fields still draws the full plan card, with no note', () => {
  const { segments } = parseContent(
    'Intro.\n<execution_plan><query_summary>TEST DATA deposit claim</query_summary></execution_plan>\nAnswer.',
  );
  assert.deepEqual(
    segments.map((segment) => segment.type),
    ['text', 'execution_plan', 'text'],
  );
  const plan = segments.find((segment) => segment.type === 'execution_plan');
  assert.equal(plan?.type === 'execution_plan' && plan.plan.querySummary, 'TEST DATA deposit claim');
  assert.equal(plan?.type === 'execution_plan' && plan.plan.note, undefined);
});

test('a plan block still streaming (no closing tag) never reaches the text', () => {
  const { segments } = parseContent(`TEST DATA. Working on it.\n\n<execution_plan>\n${PLACEHOLDERS[1].slice(0, 12)}`);
  assert.deepEqual(texts(segments), ['TEST DATA. Working on it.']);
  assert.deepEqual(segments.at(-1), {
    type: 'generating',
    element: 'execution_plan',
    raw: `<execution_plan>\n${PLACEHOLDERS[1].slice(0, 12)}`,
  });
});

test('the card draws a note-only plan as one quiet grey row, the note as written', () => {
  const card = readFileSync(
    join(here, '..', '..', 'v2', 'features', 'conversations', 'conversation', 'cards', 'ExecutionPlanCard.tsx'),
    'utf8',
  );
  assert.match(card, /if \(!plan\.totalQuestions && !plan\.querySummary && plan\.note\) \{/);
  assert.match(card, /<CardContent className="flex items-start gap-2 text-sm text-muted-foreground">/);
  assert.match(card, /<span className="font-medium">Execution plan<\/span>\s*<span aria-hidden> · <\/span>\s*<span>\{plan\.note\}<\/span>/);
});
