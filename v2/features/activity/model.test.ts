import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActivityMessage } from '@/types/chat';
import {
  attachmentMarks,
  clockTime,
  conversationTitle,
  dayKey,
  dayLabel,
  groupActivity,
  questionPreview,
  titleRepeatsQuestion,
} from './model';

/* Rows shaped like GET /api/messages?role=user returns them (read 5 October
 * 2026): id, conversation_id, conversation {uuid, title}, agent_id, role,
 * content, metadata, created_at. */
function message(
  id: number,
  createdAt: string,
  conversation: { uuid: string; title: string },
  content = `Question ${id}`,
  metadata: ActivityMessage['metadata'] = {},
): ActivityMessage {
  return {
    id,
    conversation_id: conversation.uuid,
    conversation,
    agent_id: null,
    role: 'user',
    content,
    metadata,
    created_at: createdAt,
  };
}

const contract = { uuid: 'c-1', title: 'In two sentences, what is consideration in contrac...' };
const tenancy = { uuid: 'c-2', title: 'I act for the tenant, Mrs Ngozi Eze. Review this t...' };

test('a plain question previews as typed, on one line', () => {
  const preview = questionPreview({ content: 'What is an offer?\n\nAnswer briefly.', metadata: {} });
  assert.deepEqual(preview, { text: 'What is an offer? Answer briefly.', pastes: 0, files: 0 });
});

test('a paste is counted beside the typed words, not printed inside them', () => {
  const preview = questionPreview({
    content: '<pasted_content>Clause 9. The landlord may enter at any time.</pasted_content>\n\nIs clause 9 lawful in Lagos?',
    metadata: {},
  });
  assert.deepEqual(preview, { text: 'Is clause 9 lawful in Lagos?', pastes: 1, files: 0 });
});

test('a question that is only a paste has no words and one paste', () => {
  const preview = questionPreview({ content: '<pasted_content>Long text</pasted_content>', metadata: null });
  assert.deepEqual(preview, { text: '', pastes: 1, files: 0 });
});

test('content tags and file markers never reach the preview', () => {
  const preview = questionPreview({
    content: '<case_slug>efcc-v-reinl</case_slug> Summarise this case <attached_image name="a1.png" />',
    metadata: {
      files: [
        { file_id: 1, file_name: 'a1.png', file_size: 10 },
        // A page picture the server made from a scanned PDF is not the reader's file.
        { file_id: 2, file_name: 'p1.png', file_size: 10, rendered_from_file_id: 9 },
      ],
    },
  });
  assert.deepEqual(preview, { text: 'Summarise this case', pastes: 0, files: 1 });
});

test('attachments read as a quiet count', () => {
  assert.deepEqual(attachmentMarks({ text: 'x', pastes: 0, files: 0 }), []);
  assert.deepEqual(attachmentMarks({ text: '', pastes: 2, files: 1 }), [
    { kind: 'pastes', label: '2 pasted texts' },
    { kind: 'files', label: '1 file' },
  ]);
  assert.deepEqual(attachmentMarks({ text: '', pastes: 1, files: 3 }), [
    { kind: 'pastes', label: 'Pasted text' },
    { kind: 'files', label: '3 files' },
  ]);
});

test('a title loses its tags and an empty one gets a name', () => {
  assert.equal(conversationTitle('<pasted_content>Read this</pasted_content>'), 'Read this');
  assert.equal(conversationTitle('  '), 'Untitled chat');
});

test('a cut title repeats the question it was made from', () => {
  assert.equal(
    titleRepeatsQuestion(
      'What did the Supreme Court decide in EFCC v Reinl,...',
      'What did the Supreme Court decide in EFCC v Reinl, and which earlier cases did it rely on?',
    ),
    true,
  );
  assert.equal(titleRepeatsQuestion('In one sentence, what is an offer?', 'in one sentence, what is an offer?'), true);
  assert.equal(titleRepeatsQuestion(contract.title, 'Name one Nigerian case on offer and acceptance.'), false);
  assert.equal(titleRepeatsQuestion('...', 'anything'), false);
});

test('the day is the reader\'s local day, not the server\'s', () => {
  // 23:39 UTC on 4 October is already 5 October in Lagos (UTC+1).
  assert.equal(dayKey('2026-10-04T23:39:10+00:00', 'UTC'), '2026-10-04');
  assert.equal(dayKey('2026-10-04T23:39:10+00:00', 'Africa/Lagos'), '2026-10-05');
  assert.equal(dayKey('not a date', 'UTC'), null);
});

test('day headings: today, yesterday, weekday, date, date with year', () => {
  const today = '2026-10-05';
  assert.equal(dayLabel('2026-10-05', today), 'Today');
  assert.equal(dayLabel('2026-10-04', today), 'Yesterday');
  assert.equal(dayLabel('2026-10-01', today), 'Thursday');
  assert.equal(dayLabel('2026-09-28', today), '28 September');
  assert.equal(dayLabel('2025-12-31', today), '31 December 2025');
});

test('the time of day reads in the reader\'s zone', () => {
  assert.equal(clockTime('2026-10-04T14:05:00Z', 'UTC'), '2:05 pm');
  assert.equal(clockTime('2026-10-04T14:05:00Z', 'Africa/Lagos'), '3:05 pm');
  assert.equal(clockTime('nope', 'UTC'), '');
});

test('questions fall into days, and consecutive ones in one chat share a heading', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  const days = groupActivity(
    [
      message(6, '2026-10-05T10:00:00Z', contract),
      message(5, '2026-10-05T09:00:00Z', contract),
      message(4, '2026-10-05T08:00:00Z', tenancy),
      message(3, '2026-10-05T07:00:00Z', contract),
      message(2, '2026-10-04T20:00:00Z', contract),
      message(1, 'broken', contract),
    ],
    { now, timeZone: 'UTC' },
  );

  assert.deepEqual(
    days.map((day) => [day.label, day.runs.map((run) => [run.conversationId, run.questions.map((q) => q.id)])]),
    [
      ['Today', [['c-1', [6, 5]], ['c-2', [4]], ['c-1', [3]]]],
      ['Yesterday', [['c-1', [2]]]],
    ],
  );
  assert.equal(days[0].runs[0].key, '6');
  assert.equal(days[0].runs[0].questions[0].time, '10:00 am');
});

test('a chat\'s opener alone is one row; with follow-ups a title that repeats it is not printed', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  const opener = { uuid: 'c-3', title: 'In one sentence, what is an offer in contract law?' };

  const alone = groupActivity(
    [message(1, '2026-10-05T10:00:00Z', opener, 'In one sentence, what is an offer in contract law?')],
    { now, timeZone: 'UTC' },
  );
  assert.equal(alone[0].runs[0].merged, true);

  const thread = groupActivity(
    [
      message(2, '2026-10-05T10:05:00Z', opener, 'And acceptance?'),
      message(1, '2026-10-05T10:00:00Z', opener, 'In one sentence, what is an offer in contract law?'),
    ],
    { now, timeZone: 'UTC' },
  );
  assert.equal(thread[0].runs[0].merged, false);
  assert.equal(thread[0].runs[0].questions.length, 2);
  // The title is the opener cut short, so the first question leads instead.
  assert.equal(thread[0].runs[0].titleRepeats, true);
});

test('a title of its own still heads the run', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  const named = { uuid: 'c-4', title: 'Offer and acceptance revision' };
  const days = groupActivity(
    [
      message(2, '2026-10-05T10:05:00Z', named, 'And acceptance?'),
      message(1, '2026-10-05T10:00:00Z', named, 'What is an offer?'),
    ],
    { now, timeZone: 'UTC' },
  );
  assert.equal(days[0].runs[0].titleRepeats, false);
  assert.equal(days[0].runs[0].merged, false);
});
