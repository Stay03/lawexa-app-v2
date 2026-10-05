import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActivityMessage } from '@/types/chat';
import {
  activityRow,
  askedDate,
  attachmentMarks,
  clockTime,
  conversationTitle,
  dayKey,
  questionPreview,
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

test('the day is the reader\'s local day, not the server\'s', () => {
  // 23:39 UTC on 4 October is already 5 October in Lagos (UTC+1).
  assert.equal(dayKey('2026-10-04T23:39:10+00:00', 'UTC'), '2026-10-04');
  assert.equal(dayKey('2026-10-04T23:39:10+00:00', 'Africa/Lagos'), '2026-10-05');
  assert.equal(dayKey('not a date', 'UTC'), null);
});

test('the date column: today, yesterday, day and month, then the year', () => {
  const today = '2026-10-05';
  assert.equal(askedDate('2026-10-05', today), 'Today');
  assert.equal(askedDate('2026-10-04', today), 'Yesterday');
  assert.equal(askedDate('2026-10-01', today), '1 Oct');
  assert.equal(askedDate('2026-09-28', today), '28 Sep');
  assert.equal(askedDate('2025-12-31', today), '31 Dec 2025');
  // Across the new year, yesterday is still "Yesterday".
  assert.equal(askedDate('2025-12-31', '2026-01-01'), 'Yesterday');
});

test('the time of day reads in the reader\'s zone', () => {
  assert.equal(clockTime('2026-10-04T14:05:00Z', 'UTC'), '2:05 pm');
  assert.equal(clockTime('2026-10-04T14:05:00Z', 'Africa/Lagos'), '3:05 pm');
  assert.equal(clockTime('nope', 'UTC'), '');
});

test('a row carries the question, its chat, and when it was asked in the reader\'s zone', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  const row = activityRow(message(7, '2026-10-04T23:39:10+00:00', contract, 'What is consideration?'), {
    now,
    timeZone: 'Africa/Lagos',
  });
  assert.deepEqual(row, {
    id: 7,
    conversationId: 'c-1',
    chatTitle: contract.title,
    preview: { text: 'What is consideration?', pastes: 0, files: 0 },
    marks: [],
    // 23:39 UTC on 4 October is 00:39 on 5 October in Lagos: today, not yesterday.
    date: 'Today',
    time: '12:39 am',
    createdAt: '2026-10-04T23:39:10+00:00',
  });
  assert.equal(activityRow(message(7, '2026-10-04T23:39:10+00:00', contract), { now, timeZone: 'UTC' }).date, 'Yesterday');
});

test('a row counts what was pasted and attached, and cleans the chat title', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  const row = activityRow(
    message(
      8,
      '2026-09-28T09:15:00Z',
      { uuid: 'c-5', title: '<pasted_content>Clause 9</pasted_content>' },
      '<pasted_content>Clause 9. The landlord may enter.</pasted_content>',
      { files: [{ file_id: 1, file_name: 'lease.pdf', file_size: 10 }] },
    ),
    { now, timeZone: 'UTC' },
  );
  assert.equal(row.chatTitle, 'Clause 9');
  assert.equal(row.preview.text, '');
  assert.deepEqual(row.marks, [
    { kind: 'pastes', label: 'Pasted text' },
    { kind: 'files', label: '1 file' },
  ]);
  assert.equal(row.date, '28 Sep');
  assert.equal(row.time, '9:15 am');
});

test('a row with an unreadable time keeps its place with no date', () => {
  const row = activityRow(message(9, 'broken', tenancy), { now: Date.parse('2026-10-05T12:00:00Z'), timeZone: 'UTC' });
  assert.equal(row.date, '');
  assert.equal(row.time, '');
  assert.equal(row.conversationId, 'c-2');
});
