import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Message, ThreadStatus } from '@/types/collab';
import {
  THREAD_STATUS_FILTERS,
  THREAD_STATUS_OPTIONS,
  isClosedThread,
  showsThreadStatusFilter,
  statusChangeOf,
  threadStatusErrorText,
  threadStatusFilterCount,
  threadStatusFilterLabel,
  threadStatusFilterParam,
  threadStatusFooter,
  threadStatusQuiet,
} from './thread-status-model';

/* Thread status (Stay, 15-16 October 2026, the design "locked in" from the
 * thread-status mock). Pure rules first, then the wiring, pinned by source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

const NOW = Date.parse('2026-10-16T12:00:00Z');

function status(overrides: Partial<ThreadStatus> = {}): ThreadStatus {
  return {
    value: 'running',
    label: 'Running',
    note: null,
    changed_at: '2026-10-16T11:58:00Z',
    changed_by: { uuid: 'u1', name: 'Ada Obi' },
    via: 'app',
    is_stale: false,
    ...overrides,
  };
}

test('the menu offers No status and the five statuses, in order, with the mock words', () => {
  assert.deepEqual(
    THREAD_STATUS_OPTIONS.map((option) => [option.value, option.label, option.hint]),
    [
      [null, 'No status', 'Nothing to track'],
      ['running', 'Running', 'Someone is working on it'],
      ['waiting', 'Waiting', 'Needs an answer from someone'],
      ['blocked', 'Blocked', 'Cannot move until something is fixed'],
      ['done', 'Done', 'Finished; still open for replies'],
      ['closed', 'Closed', 'Finished and filed'],
    ],
  );
});

test('the footer names who set it, an agent change names who it acted for', () => {
  assert.equal(threadStatusFooter(status(), NOW), 'Set to Running by Ada Obi · 2m ago');
  assert.equal(
    threadStatusFooter(status({ via: 'agent' }), NOW),
    'Set to Running by Lawexa for Ada Obi · 2m ago',
  );
  assert.equal(
    threadStatusFooter(status({ changed_by: null, value: 'done' }), NOW),
    'Set to Done · 2m ago',
  );
  assert.equal(
    threadStatusFooter(status({ changed_at: '2026-10-16T12:00:00Z' }), NOW),
    'Set to Running by Ada Obi · just now',
  );
  // Before the clock hydrates there is no age, never a wrong one.
  assert.equal(threadStatusFooter(status(), 0), 'Set to Running by Ada Obi');
});

test('only a stale Running or Waiting thread says it has gone quiet', () => {
  const lastMessageAt = '2026-10-15T12:00:00Z';
  assert.equal(
    threadStatusQuiet({ status: status({ is_stale: true }), last_message_at: lastMessageAt }, NOW),
    'quiet 1d',
  );
  assert.equal(
    threadStatusQuiet(
      { status: status({ is_stale: true, value: 'waiting' }), last_message_at: null },
      NOW,
    ),
    'quiet 2m',
    'no message: the age is the status change',
  );
  assert.equal(
    threadStatusQuiet({ status: status({ is_stale: true, value: 'done' }), last_message_at: lastMessageAt }, NOW),
    null,
  );
  assert.equal(threadStatusQuiet({ status: status(), last_message_at: lastMessageAt }, NOW), null);
  assert.equal(threadStatusQuiet({ status: null, last_message_at: lastMessageAt }, NOW), null);
  assert.equal(threadStatusQuiet({ last_message_at: lastMessageAt }, NOW), null);
  assert.equal(
    threadStatusQuiet({ status: status({ is_stale: true }), last_message_at: lastMessageAt }, 0),
    'quiet',
  );
});

test('a Closed thread is greyed; every other value is not', () => {
  assert.equal(isClosedThread({ status: status({ value: 'closed' }) }), true);
  assert.equal(isClosedThread({ status: status({ value: 'done' }) }), false);
  assert.equal(isClosedThread({ status: null }), false);
  assert.equal(isClosedThread({}), false);
});

test('the filter row: Any status then the five, one value on the wire', () => {
  assert.deepEqual(THREAD_STATUS_FILTERS.map(threadStatusFilterLabel), [
    'Any status',
    'Running',
    'Waiting',
    'Blocked',
    'Done',
    'Closed',
  ]);
  assert.equal(threadStatusFilterParam(null), undefined);
  assert.deepEqual(threadStatusFilterParam('blocked'), ['blocked']);
});

test('counts print on All only, and never on Any status', () => {
  const counts = { running: 2, waiting: 1, blocked: 0, done: 4, closed: 3 };
  assert.equal(threadStatusFilterCount('running', counts, false), 2);
  assert.equal(threadStatusFilterCount('blocked', counts, false), 0);
  assert.equal(threadStatusFilterCount(null, counts, false), null);
  assert.equal(threadStatusFilterCount('running', counts, true), null);
  assert.equal(threadStatusFilterCount('running', undefined, false), null);
});

test('the filter row waits for a server that knows about statuses', () => {
  assert.equal(showsThreadStatusFilter({}, [{}, {}], null), false, 'old API: unchanged sheet');
  assert.equal(showsThreadStatusFilter({}, [{ status: null }], null), true);
  assert.equal(
    showsThreadStatusFilter({ thread_status_counts: { running: 0, waiting: 0, blocked: 0, done: 0, closed: 0 } }, [], null),
    true,
  );
  assert.equal(showsThreadStatusFilter({}, [], 'done'), true, 'an empty filtered list keeps its way back');
});

function systemLine(metadata: Partial<Message['metadata']>, content: string): Message {
  return {
    uuid: 'm1',
    channel_uuid: 't1',
    is_ai: false,
    author: null,
    content,
    created_at: '2026-10-16T14:43:00Z',
    metadata: { mentions: [], lawexa_mentioned: false, ...metadata },
  } as unknown as Message;
}

test('a status line is read off metadata.type, never off the author', () => {
  assert.deepEqual(
    statusChangeOf(
      systemLine(
        {
          type: 'thread_status_changed',
          from: null,
          to: 'done',
          note: ' shipped ',
          actor_uuid: 'u1',
          actor_name: 'Ada',
          via: 'agent',
        },
        'Lawexa (for Ada) set this thread to Done: shipped',
      ),
    ),
    {
      from: null,
      to: 'done',
      note: 'shipped',
      byName: 'Ada',
      via: 'agent',
      at: '2026-10-16T14:43:00Z',
      sentence: 'Lawexa (for Ada) set this thread to Done: shipped',
    },
  );
  assert.equal(statusChangeOf(systemLine({ type: 'member_joined' }, 'Ada joined the channel')), null);
  assert.equal(statusChangeOf(systemLine({}, 'hello')), null);
  // A cleared status, and a value this app does not know yet: no chip either way.
  const cleared = statusChangeOf(
    systemLine({ type: 'thread_status_changed', from: 'running', to: null }, "Ada cleared this thread's status"),
  );
  assert.equal(cleared?.to, null);
  assert.equal(cleared?.from, 'running');
  const unknown = statusChangeOf(
    systemLine({ type: 'thread_status_changed', to: 'paused' as never }, 'Ada set this thread to Paused'),
  );
  assert.equal(unknown?.to, null);
});

test('a refusal shows the field error, else the server sentence', () => {
  assert.equal(
    threadStatusErrorText({
      message: 'Only a thread can have a status.',
      errors: { status: ['Only a thread can have a status.'] },
    }),
    'Only a thread can have a status.',
  );
  assert.equal(
    threadStatusErrorText({ message: 'The given data was invalid.', errors: { note: ['The note is too long.'] } }),
    'The note is too long.',
  );
  assert.equal(
    threadStatusErrorText({ message: 'This action is unauthorized.', errors: null }),
    'This action is unauthorized.',
  );
});

/* ── Wiring ────────────────────────────────────────────────────────────── */

test('every thread list draws the chip after the title, and greys a Closed title', () => {
  for (const parts of [
    ['v2', 'features', 'channels', 'threads', 'ThreadsSheet.tsx'],
    ['v2', 'features', 'spaces', 'detail', 'SpaceThreadRow.tsx'],
    ['v2', 'features', 'channels', 'my-channels', 'MyThreadRow.tsx'],
  ]) {
    const row = read(...parts);
    assert.match(row, /\{title\}\s*<\/span>[\s\S]{0,400}<ThreadStatusChip\b/, parts.join('/'));
    assert.match(row, /isClosedThread\(thread\)/, parts.join('/'));
    assert.match(row, /threadStatusQuiet\(thread, now\)/, parts.join('/'));
  }
});

test('the Threads sheet filters through the server, keyed by status', () => {
  const sheet = read('v2', 'features', 'channels', 'threads', 'ThreadsSheet.tsx');
  assert.match(sheet, /showsThreadStatusFilter\(channel, threads, statusFilter\)/);
  assert.match(sheet, /channelsQueries\.threads\(\{\s*channelUuid: channel\.uuid,\s*mine,\s*status: statusFilter,\s*viewerId,?\s*\}\)/);
  assert.match(sheet, /threadStatusFilterCount\(\s*entry,\s*channel\.thread_status_counts,\s*mine,?\s*\)/);
  const queries = read('v2', 'features', 'channels', 'queries.ts');
  assert.match(queries, /\{ mine, status \}/);
  assert.match(queries, /status: threadStatusFilterParam\(status\)/);
});

test('a thread header carries the status control only for someone who can post', () => {
  const screen = read('v2', 'features', 'channels', 'screen', 'ChannelScreen.tsx');
  assert.match(screen, /isThread && channel\.status !== undefined/);
  assert.match(screen, /canSet=\{canParticipate\}/);
  const header = read('v2', 'features', 'channels', 'screen', 'PlaceHeader.tsx');
  // One of each, each shown at its own width only.
  assert.match(header, /md:hidden">\s*\{renderStatus\('sheet'\)\}/);
  assert.match(header, /hidden shrink-0 items-center md:flex">\s*\{renderStatus\('menu'\)\}/);
});

test('a status change draws as a quiet line with its chip, and moves the caches live', () => {
  const divider = read('v2', 'features', 'channels', 'feed', 'FeedDivider.tsx');
  assert.match(divider, /statusChangeOf\(message\)/);
  const room = read('v2', 'features', 'channels', 'room.ts');
  assert.match(room, /room\.listen\('\.channel\.status_changed'/);
  assert.match(room, /applyThreadStatus\(queryClient, payload\.thread_uuid, payload\.status\)/);
});
