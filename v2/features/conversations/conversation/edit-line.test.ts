import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ApiMessage, ChatMessage, ConversationStatusData, EventMessage } from '@/types/chat';
import type { EngineMessage } from '@/v2/runtime/chat-engine/types';
import { groupMessages, isLineGroup, lastTurnGroupIndex, type MessageGroup } from './message-groups';
import { spaceMarks } from './space-marks';
import { turnBegan, turnChanged } from './space-turn';
import { replyTargetOf } from './reply-target';
import { draftOrdinalForLine } from './rows/event-line';
import { applyDraftEditLine, editedAfterSave } from './draft/draft-edit-line';
import { draftOffsets } from './draft/draft-ordinals';

/* The draft "edited" line in the chat (Stay, 30 October 2026, 02:16Z, thread
 * 1e44eb39; design 9b43f942): a quiet centred line, never a turn. It carries
 * no Lawexa mark, no reply, no actions; it never counts as a new message; and
 * it shows at once for the reader who saved and within the 4 s poll for the
 * rest of a Space chat. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const here = (...parts: string[]) => read('v2', 'features', 'conversations', 'conversation', ...parts);

const at = (minute: number) => new Date(2026, 9, 30, 10, minute);
const turnRow = (role: 'user' | 'assistant', minute: number): EngineMessage =>
  ({ id: `${role}-${minute}`, role, content: 'x', timestamp: at(minute) }) as ChatMessage;
const lineRow = (minute: number, title = 'Lease agreement'): EngineMessage =>
  ({
    id: `msg_${900 + minute}`,
    role: 'event',
    eventType: 'draft_edit',
    serverId: 900 + minute,
    content: `Stay edited '${title}'`,
    timestamp: at(minute),
    editedAt: at(minute + 5),
    editorName: 'Stay',
    editorUuid: 'u-stay',
    draftTitle: title,
    noteId: 1,
  }) satisfies EventMessage;

// ─── Groups and marks ────────────────────────────────────────────────────────

test('a line is its own group, and the last turn group skips it', () => {
  const groups = groupMessages([turnRow('user', 0), turnRow('assistant', 1), lineRow(2)]);
  assert.equal(groups.length, 3);
  assert.equal(isLineGroup(groups[2]), true);
  assert.equal(isLineGroup(groups[1]), false);
  assert.equal(lastTurnGroupIndex(groups), 1);
  assert.equal(lastTurnGroupIndex(groupMessages([lineRow(2)])), -1);
});

test('a line never carries Lawexa’s mark, and the answer after a line under a question still does', () => {
  const groups: MessageGroup[] = groupMessages([turnRow('user', 0), lineRow(1), turnRow('assistant', 2), lineRow(3)]);
  const marks = spaceMarks(groups);
  assert.deepEqual(
    marks.map((mark) => mark.answer),
    [null, null, at(2), null],
  );
});

// ─── The Space poll ──────────────────────────────────────────────────────────

const status = (over: Partial<ConversationStatusData> = {}) =>
  ({
    execution_id: 'e1',
    pending_since: '2026-10-30T09:00:00Z',
    last_message_id: 10,
    last_event_at: null,
    ...over,
  }) as ConversationStatusData;

test('a line made or moved reads the transcript again, without moving the chat up the lists', () => {
  const before = status();
  const edited = status({ last_event_at: '2026-10-30T10:05:00Z' });
  assert.equal(turnChanged(before, edited), true);
  assert.equal(turnBegan(before, edited), false);
  assert.equal(turnChanged(edited, status({ last_event_at: '2026-10-30T10:07:00Z' })), true);
  // A server without the field: absent on both reads, no change.
  const old = { ...before };
  delete old.last_event_at;
  assert.equal(turnChanged(old, { ...old }), false);
  assert.equal(turnChanged(old, before), false, 'absent and null read the same');
  // A turn still moves it.
  assert.equal(turnBegan(before, status({ last_message_id: 11 })), true);
  const controller = here('useConversationController.ts');
  assert.match(controller, /if \(changed\) void queryClient\.refetchQueries\(\{ queryKey: detailKey, exact: true \}\);/);
});

// ─── The row ─────────────────────────────────────────────────────────────────

test('a line is never a reply target and holds no draft', () => {
  assert.equal(replyTargetOf(lineRow(1) as never), null);
  const rows = [turnRow('user', 0), lineRow(1), turnRow('assistant', 2)];
  assert.deepEqual([...draftOffsets(rows).entries()], [...draftOffsets([rows[0], rows[2]]).entries()]);
});

test('the title opens the draft whose note the line names, else stays plain', () => {
  // The line names its note by id (Backend 5c7ee620), as the draft list does.
  const doc = (noteId: number | null, ordinal: number) => ({
    latest_ordinal: ordinal,
    note: noteId === null ? null : { id: noteId, slug: `n-${noteId}`, title: 'Lease agreement', updated_at: '' },
  });
  assert.equal(draftOrdinalForLine([doc(41, 3), doc(42, 1)], 41), 3);
  // Two drafts with one title are still told apart.
  assert.equal(draftOrdinalForLine([doc(41, 3), doc(42, 5)], 42), 5);
  // A draft with no note, or a note the list does not hold, opens nothing.
  assert.equal(draftOrdinalForLine([doc(null, 2)], 41), null);
  assert.equal(draftOrdinalForLine([doc(41, 3)], 99), null);
  assert.equal(draftOrdinalForLine(undefined, 41), null);
});

test('the row is a quiet centred note: an icon, the words, the time; no bubble, actions or reply', () => {
  const row = here('rows', 'EventLineRow.tsx');
  assert.match(row, /role="note"/);
  assert.match(row, /className="flex items-center justify-center gap-1\.5 px-4 text-center text-xs text-muted-foreground"/);
  assert.match(row, /<PenLine aria-hidden className="size-3\.5 shrink-0" \/>/);
  assert.match(row, /\{line\.editorName\} edited\{' '\}/);
  assert.match(row, /const title = `'\$\{line\.draftTitle\}'`;/);
  assert.match(row, /· <time dateTime=\{line\.editedAt\.toISOString\(\)\}>\{at\}<\/time>/);
  assert.match(row, /const at = clockTime\(line\.editedAt\);/);
  assert.match(row, /onClick=\{\(\) => panel\.open\(\{ kind: 'draft', ordinal \}\)\}/);
  // Read from the cache the draft cards fill: no request of its own.
  assert.match(row, /enabled: false,/);
  assert.doesNotMatch(row, /HoverReply|SwipeToReply|onReply|Copy|rounded-2xl|Avatar/);
});

test('the list draws a line by its own row, never as a turn', () => {
  const list = here('MessageList.tsx');
  assert.match(list, /if \(isEventMessage\(message\)\) \{\s*body = <EventLineRow line=\{message\} \/>;\s*\} else if \(isErrorMessage\(message\)\) \{/);
  assert.match(list, /const messageId = group\.type === 'single' && !isLineGroup\(group\) \? savedIdOf\(group\.message\) : null;/);
  // The answer being written, "Ask again" and the working row read the last TURN group.
  assert.match(list, /const lastTurnIndex = lastTurnGroupIndex\(groups\);/);
  assert.match(list, /const lastGroup = groups\[lastTurnIndex\];/);
  assert.match(list, /isLastGroup=\{gi === lastTurnIndex\}/);
  // A line never pulls the scroll: only a new question does.
  assert.match(list, /if \(last && last\.role === 'user' && messages\.length > prevLen\) \{/);
});

test('the "New message" pill counts turns, never lines', () => {
  const list = here('MessageList.tsx');
  assert.match(list, /const turnCount = useMemo\(\(\) => turnRowCount\(messages\), \[messages\]\);/);
  assert.match(list, /const pillCount = detachedAt === null \? 0 : Math\.max\(0, turnCount - detachedAt\);/);
  assert.match(list, /setDetachedAt\(turnCount\);/);
  assert.doesNotMatch(list, /setDetachedAt\(messages\.length\)/);
});

test('"Ask again" reads the last turn, so a line under the answer keeps it', () => {
  const controller = here('useConversationController.ts');
  assert.match(controller, /const lastIsCompletedAssistant = useMemo\(\(\) => \{\s*const last = lastTurnRow\(messages\);/);
});

test('the draft panel waits for an answer due under a line too', () => {
  assert.match(here('draft', 'DraftPanel.tsx'), /lastTurnRow\(messages\)\?\.role === 'user'/);
});

// ─── The save and the restore ────────────────────────────────────────────────

test('a save’s answer takes away every removed line, then draws the new one; absent fields do nothing', () => {
  const calls: string[] = [];
  const engine = {
    upsertEvent: (row: ApiMessage) => {
      calls.push(`upsert ${row.id}`);
      return true;
    },
    removeEvent: (id: number) => {
      calls.push(`remove ${id}`);
      return true;
    },
  };
  const row = { id: 9 } as ApiMessage;
  applyDraftEditLine(engine, { draft_edit_line: row, draft_edit_line_removed_ids: [4, 7] });
  applyDraftEditLine(engine, {});
  applyDraftEditLine(engine, { draft_edit_line: null, draft_edit_line_removed_ids: null });
  applyDraftEditLine(engine, { draft_edit_line: null, draft_edit_line_removed_ids: [] });
  assert.deepEqual(calls, ['remove 4', 'remove 7', 'upsert 9']);
});

test('the draft save and the restore both hand their answer to the chat', () => {
  const editor = here('draft', 'DraftEditor.tsx');
  assert.match(editor, /onSaved: \(_record, envelope\) => \{[\s\S]*?chat\?\.applyDraftEditLine\(envelope\);/);
  const history = here('draft', 'DraftHistoryDialog.tsx');
  assert.match(history, /onSuccess: \(answer\) => \{[\s\S]*?chat\?\.applyDraftEditLine\(answer\);/);
  // The autosave passes the whole answer on.
  assert.match(read('v2', 'features', 'notes', 'editor', 'use-autosave.ts'), /void onSavedRef\.current\?\.\(record, envelope\);/);
  // The chat's screen reaches its engine through the chat context.
  const screen = here('ConversationScreen.tsx');
  assert.match(screen, /applyDraftEditLine\(\{ upsertEvent, removeEvent \}, answer\)/);
  assert.match(screen, /applyDraftEditLine=\{onDraftEditLine\}/);
});

test('a save that takes lines away clears the card’s "Edited"; any other save sets it', () => {
  assert.equal(editedAfterSave({ draft_edit_line: null, draft_edit_line_removed_ids: [175] }), false);
  assert.equal(editedAfterSave({ draft_edit_line: { id: 9 } as ApiMessage, draft_edit_line_removed_ids: [] }), true);
  // The switch off, or an older server: the fields are absent, and a save is an edit as before.
  assert.equal(editedAfterSave({}), true);
  assert.equal(editedAfterSave(undefined), true);
  const editor = here('draft', 'DraftEditor.tsx');
  assert.match(editor, /markDraftEdited\(queryClient, \{ conversationId, viewerId \}, mode\.documentKey, editedAfterSave\(envelope\)\);/);
});
