import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ApiMessage, BackgroundJobEvent } from '@/types/chat';
import { isBackgroundJobLine, transformApiMessages } from '@/lib/utils/transform-api-messages';
import { placeEvent } from '@/v2/runtime/chat-engine/event-rows';
import type { EngineMessage } from '@/v2/runtime/chat-engine/types';
import { presentNotification } from '@/v2/features/notifications/presentation';
import type { Notification } from '@/types/notification';

/* Background jobs, app side (Backend's shapes 063d9cc3,
 * docs/api/background-jobs-shapes.md; thread 1874e291). TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const here = (...parts: string[]) => read('v2', 'features', 'conversations', 'conversation', ...parts);

const iso = (minutes: number) => new Date(Date.parse('2026-11-11T09:00:00Z') + minutes * 60_000).toISOString();
const row = (id: number, role: ApiMessage['role'], content: string, metadata: ApiMessage['metadata'] = {}): ApiMessage => ({
  id,
  conversation_id: 'conv-1',
  agent_id: null,
  role,
  content,
  metadata,
  created_at: iso(id),
});
const wake = (id: number) =>
  row(id, 'user', 'Background work you started earlier in this chat has ended:\n- Job job-1 (Reading a file) finished: …', {
    type: 'background_job_result',
    background_jobs: [{ job_id: 'job-1', kind: 'file_transcription', outcome: 'succeeded' }],
  });
const giveUp = (id: number) =>
  row(id, 'assistant', 'The file reading you asked for finished, but Lawexa couldn’t come back to it automatically. Ask about it to continue.', {
    type: 'background_job_unanswered',
    background_jobs: [{ job_id: 'job-1', kind: 'file_transcription', outcome: 'succeeded' }],
  });

test('Lawexa’s return and its give-up notice are lines in v2, never bubbles', () => {
  assert.equal(isBackgroundJobLine(wake(2)), true);
  assert.equal(isBackgroundJobLine(giveUp(2)), true);
  // Only those roles with those types.
  assert.equal(isBackgroundJobLine(row(2, 'assistant', 'x', { type: 'background_job_result' })), false);
  assert.equal(isBackgroundJobLine(row(2, 'user', 'x', { type: 'background_job_unanswered' })), false);
  assert.equal(isBackgroundJobLine(row(2, 'user', 'x')), false);

  const rows = transformApiMessages([row(1, 'user', 'TEST DATA. Read the lease.'), wake(2), row(3, 'assistant', 'TEST DATA. The lease says…'), giveUp(4)], {
    events: true,
  });
  assert.deepEqual(
    rows.map((r) => r.role),
    ['user', 'event', 'assistant', 'event'],
  );
  const back = rows[1] as BackgroundJobEvent;
  assert.equal(back.eventType, 'background_job_result');
  assert.deepEqual(back.jobs, [{ job_id: 'job-1', kind: 'file_transcription', outcome: 'succeeded' }]);
  assert.equal((rows[3] as BackgroundJobEvent).eventType, 'background_job_unanswered');
});

test('v1, which asks for no lines, draws them as it already did', () => {
  // v1 is frozen: the return stays a bubble there, and an assistant row of a
  // type it does not know was already left out before this change.
  const rows = transformApiMessages([wake(2), giveUp(3)]);
  assert.deepEqual(
    rows.map((r) => r.role),
    ['user'],
  );
});

test('the same return read twice changes nothing', () => {
  const [line] = transformApiMessages([wake(2)], { events: true }) as EngineMessage[];
  const held = transformApiMessages([row(1, 'user', 'TEST DATA. Read the lease.')], { events: true }) as EngineMessage[];
  const placed = placeEvent(held, line as BackgroundJobEvent);
  assert.equal(placeEvent(placed, { ...(line as BackgroundJobEvent) }), placed);
});

test('the line draws the return’s words from its jobs, and the give-up notice as written', () => {
  const lines = here('rows', 'EventLineRow.tsx');
  assert.match(lines, /case 'background_job_result':\s*case 'background_job_unanswered':\s*return <BackgroundJobLine line=\{line\} \/>;/);
  assert.match(
    lines,
    /const words = line\.eventType === 'background_job_result' \? backgroundReturnLine\(line\.jobs\) : line\.content;/,
  );
});

test('the label sits under the question that started the work', () => {
  const list = here('MessageList.tsx');
  assert.match(list, /<BackgroundJobsLabel messageId=\{savedIdOf\(message\)\} \/>/);
  const screen = here('ConversationScreen.tsx');
  assert.match(screen, /<BackgroundJobsProvider conversationId=\{conversationId\} jobs=\{controller\.backgroundJobs\}>/);
});

test('a personal chat waiting on a job follows Lawexa’s return live, and re-reads its jobs when a turn ends', () => {
  const controller = here('useConversationController.ts');
  assert.match(controller, /const readsBackgroundJobs = detailData !== null && \(isOwner \|\| isSpaceMember\) && !isConfidential && !isGoneOnServer;/);
  assert.match(controller, /\(isSpaceMember \|\| awaitingBackgroundJob\) &&/);
  assert.match(controller, /if \(ended && readsBackgroundJobs\) \{/);
  const queries = read('v2', 'features', 'conversations', 'queries.ts');
  assert.match(queries, /awaitsBackgroundJob\(query\.state\.data\?\.data\.background_jobs \?\? \[\]\)\s*\? BACKGROUND_JOBS_POLL_MS\s*: false,/);
});

test('a notification about a chat re-reads that chat and its jobs', () => {
  const spine = read('v2', 'runtime', 'realtime', 'spine.tsx');
  assert.match(spine, /if \(payload\?\.conversation_uuid\) refreshNotifiedChat\(queryClient, payload\.conversation_uuid\);/);
  assert.match(spine, /queryKey: \[\.\.\.conversationsQueries\.details\(\), conversationId\]/);
  assert.match(spine, /queryKey: conversationsQueries\.backgroundJobsOf\(conversationId\)/);
});

test('the notification opens the chat, in the server’s words or ours', () => {
  const base = {
    id: 'n-1',
    type: 'background_job_answered',
    icon: 'chat',
    action_url: '/c/00000000-0000-4000-8000-000000000601',
    read_at: null,
    created_at: iso(5),
  };
  const titled = presentNotification({ ...base, title: 'Lawexa has an update in TEST DATA lease review', message: 'Reading a file is done. Lawexa has replied.' } as unknown as Notification, 'http://localhost:3472');
  assert.equal(titled.title, 'Lawexa has an update in TEST DATA lease review');
  assert.deepEqual(titled.destination, { kind: 'internal', href: '/c/00000000-0000-4000-8000-000000000601' });
  const bare = presentNotification({ ...base, title: null, message: null } as unknown as Notification, 'http://localhost:3472');
  assert.equal(bare.title, 'Lawexa has an update in your chat');
});
