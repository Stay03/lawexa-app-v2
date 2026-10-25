import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContent, type ContentSegment } from './parse-content-xml';

/* Expert answers, 25 October 2026: an answer showed the raw tags
 * "<execution_plan> (Already output earlier in this conversation.)
 * </execution_plan>". A plan block with no fields was never matched, so its
 * text fell through to the markdown. Every plan block is now cut out; only one
 * with fields draws a card. */

const PLACEHOLDERS = ['(Already output earlier in this conversation.)', '(Output above, before any tool call.)'];

const texts = (segments: ContentSegment[]) =>
  segments.flatMap((segment) => (segment.type === 'text' ? [segment.content] : []));

for (const placeholder of PLACEHOLDERS) {
  test(`a plan block holding only "${placeholder}" is cut out and draws nothing`, () => {
    const { segments } = parseContent(
      `TEST DATA. Here is the answer.\n\n<execution_plan>\n${placeholder}\n</execution_plan>\n\nThe tenant may recover the deposit.`,
    );
    assert.deepEqual(texts(segments), ['TEST DATA. Here is the answer.', 'The tenant may recover the deposit.']);
    assert.equal(segments.some((segment) => segment.type === 'execution_plan'), false);
    for (const text of texts(segments)) {
      assert.doesNotMatch(text, /execution_plan|Already output|Output above/);
    }
  });
}

test('an answer that is only an empty plan block shows nothing, not the raw tags', () => {
  assert.deepEqual(parseContent(`<execution_plan>${PLACEHOLDERS[0]}</execution_plan>`).segments, []);
});

test('a plan block with fields still draws the plan card', () => {
  const { segments } = parseContent(
    'Intro.\n<execution_plan><query_summary>TEST DATA deposit claim</query_summary></execution_plan>\nAnswer.',
  );
  assert.deepEqual(
    segments.map((segment) => segment.type),
    ['text', 'execution_plan', 'text'],
  );
  const plan = segments.find((segment) => segment.type === 'execution_plan');
  assert.equal(plan?.type === 'execution_plan' && plan.plan.querySummary, 'TEST DATA deposit claim');
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
