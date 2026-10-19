import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_PICTURE_BYTES,
  feedbackText,
  pictureRefusal,
} from './feedback-model';

/* v2 Stage 1, item 5: "Give feedback" on cases, statutes and notes, one shared
 * button and form, sending v1's report to `POST /feedback`. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

test('each type offers v1’s issues, word for word', () => {
  const v1 = read('components', 'feedback', 'feedback-constants.ts');
  for (const type of ['case', 'note', 'statute'] as const) {
    for (const { id, label } of FEEDBACK_CATEGORIES[type]) {
      assert.ok(v1.includes(`{ id: '${id}', label: '${label}' }`), `${type}: ${id}`);
    }
  }
  assert.equal(FEEDBACK_CATEGORIES.case.length, 8);
  assert.equal(FEEDBACK_CATEGORIES.note.length, 7);
  assert.equal(FEEDBACK_CATEGORIES.statute.length, 7);
});

test('the report reads as v1’s: the ticked issues, then the reader’s words', () => {
  assert.equal(
    feedbackText('statute', ['missing_sections', 'app_crashed'], '  Section 4 is cut off.  '),
    'Issues: The app crashed, Missing sections or provisions\n\nDetails: Section 4 is cut off.',
  );
  assert.equal(feedbackText('case', [], 'Only words'), 'Details: Only words');
  assert.equal(feedbackText('note', ['formatting_issues'], '   '), 'Issues: Formatting issues');
  // Nothing ticked and nothing typed is nothing to send.
  assert.equal(feedbackText('case', [], '  '), '');
  // An id that is not this type's is never sent.
  assert.equal(feedbackText('note', ['missing_sections'], ''), '');
});

test('a picture goes with the report only if it is one, and 5 MB or less', () => {
  assert.equal(pictureRefusal({ name: 'a.png', type: 'image/png', size: 1000 }), null);
  assert.equal(pictureRefusal({ name: 'b.webp', type: 'image/webp', size: FEEDBACK_MAX_PICTURE_BYTES }), null);
  assert.match(pictureRefusal({ name: 'c.pdf', type: 'application/pdf', size: 10 }) ?? '', /isn't a picture/);
  assert.match(pictureRefusal({ name: 'd.jpg', type: 'image/jpeg', size: FEEDBACK_MAX_PICTURE_BYTES + 1 }) ?? '', /larger than 5 MB/);
});

test('one button on all three pages, sending through v1’s feedback call', () => {
  assert.match(read('v2', 'features', 'cases', 'detail', 'CaseActions.tsx'), /<FeedbackButton type="case" contentId=\{caseId\} \/>/);
  assert.match(read('v2', 'features', 'statutes', 'reader', 'StatuteHeader.tsx'), /<FeedbackButton type="statute" contentId=\{detail\.id\} \/>/);
  assert.match(read('v2', 'features', 'notes', 'reader', 'NoteActions.tsx'), /<FeedbackButton type="note" contentId=\{noteId\} \/>/);
  const button = read('v2', 'features', 'feedback', 'FeedbackButton.tsx');
  assert.match(button, /feedbackApi\.submit\(\{\s*feedback_text: text,\s*content_type: type,\s*content_id: contentId,/);
  // An empty report is refused in place, and a session is needed to send at all.
  assert.match(button, /if \(!text\) \{\s*setProblem\('Tick an issue or tell us in your own words\.'\);/);
  assert.match(button, /const \{ signedIn \} = useV2Session\(\);\s*if \(!signedIn\) return null;/);
});

test('a send that never reached the server says so, and keeps the report', () => {
  const button = read('v2', 'features', 'feedback', 'FeedbackButton.tsx');
  assert.match(button, /isAxiosError\(error\) && !error\.response\s*\? "Couldn't reach Lawexa, so nothing was sent\. Your report is still here: try again\."\s*: getErrorMessage\(error\)/);
});
