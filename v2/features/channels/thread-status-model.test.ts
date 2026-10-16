import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Message, ThreadStatus } from '@/types/collab';
import {
  THREAD_STATUS_FILTERS,
  THREAD_STATUS_OPTIONS,
  createTrailingCoalescer,
  isClosedThread,
  isSameThreadStatus,
  isStatusFilteredThreadsKey,
  nextRadioIndex,
  shiftThreadStatusCounts,
  showsThreadStatusFilter,
  spellQuiet,
  statusChangeOf,
  threadStatusErrorText,
  threadStatusFilterCount,
  threadStatusFilterLabel,
  threadStatusFilterParam,
  threadStatusFooter,
  threadStatusQuiet,
  threadStatusTriggerLabel,
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
  assert.match(header, /flex min-w-0 flex-1 items-center gap-2 md:hidden">/);
  assert.match(header, /hidden shrink-0 items-center md:flex">\s*\{renderStatus\('menu'\)\}/);
});

test('on a phone the status stands in the subtitle line and the title keeps the row', () => {
  const header = read('v2', 'features', 'channels', 'screen', 'PlaceHeader.tsx');
  // The status is the second line of the identity column, under the title,
  // never a sibling in the title row.
  assert.match(
    header,
    /data-phone-status-line[\s\S]{0,700}\{displayName\}\s*<span className="sr-only">\{`, \$\{phoneSubtitle\}`\}<\/span>\s*<\/button>\s*<div className="flex min-w-0 max-w-full items-center">\s*\{renderStatus\('sheet'\)\}/,
  );
  assert.equal(header.match(/renderStatus\('sheet'\)/g)?.length, 1);
  // Without a status line the phone bar is the one it always was.
  assert.match(header, /\) : \(\s*<button\s+type="button"\s+onClick=\{onOpenAbout\}[\s\S]{0,1600}\{phoneSubtitle\}/);
  // No status and no way to set one: no slot, so the subtitle stays.
  const screen = read('v2', 'features', 'channels', 'screen', 'ChannelScreen.tsx');
  assert.match(screen, /threadStatus === undefined \|\| \(threadStatus === null && !canParticipate\)/);
  // The phone's trigger is the row chip, no taller than it.
  const control = read('v2', 'features', 'channels', 'threads', 'ThreadStatusControl.tsx');
  assert.match(control, /className=\{TRIGGER_COMPACT\}\s*>\s*<TriggerFace status=\{status\} quiet=\{quiet\} compact \/>/);
});

test('the feed status line wraps to two lines, chip on the first', () => {
  const divider = read('v2', 'features', 'channels', 'feed', 'FeedDivider.tsx');
  const line = divider.slice(divider.indexOf('function StatusChangeLine'));
  const body = line.slice(0, line.search(/\n\}\r?\n/));
  assert.match(body, /flex items-start justify-center/);
  assert.match(body, /line-clamp-2/);
  assert.doesNotMatch(body, /\btruncate\b/);
});

test('a status change draws as a quiet line with its chip, and moves the caches live', () => {
  const divider = read('v2', 'features', 'channels', 'feed', 'FeedDivider.tsx');
  assert.match(divider, /statusChangeOf\(message\)/);
  const room = read('v2', 'features', 'channels', 'room.ts');
  assert.match(room, /room\.listen\('\.channel\.status_changed'/);
  assert.match(
    room,
    /noteThreadStatusChange\(queryClient, payload\.thread_uuid, parentUuid, payload\.status\)/,
  );
});

/* ── Checker round (16 October 2026) ───────────────────────────────────── */

test('a status change moves the parent counts locally and never re-reads the parent', () => {
  const counts = { running: 2, waiting: 1, blocked: 0, done: 0, closed: 0 };
  assert.deepEqual(shiftThreadStatusCounts(counts, 'running', 'done'), {
    running: 1,
    waiting: 1,
    blocked: 0,
    done: 1,
    closed: 0,
  });
  assert.deepEqual(shiftThreadStatusCounts(counts, null, 'blocked').blocked, 1);
  assert.deepEqual(shiftThreadStatusCounts(counts, 'waiting', null).waiting, 0);
  assert.equal(shiftThreadStatusCounts(counts, 'done', 'done'), counts, 'no move, same object');
  assert.equal(shiftThreadStatusCounts(counts, 'blocked', null).blocked, 0, 'never below zero');

  const cache = read('v2', 'features', 'channels', 'cache.ts');
  const room = read('v2', 'features', 'channels', 'room.ts');
  const mutations = read('v2', 'features', 'channels', 'threads', 'mutations.ts');
  // The old per-change parent re-read is gone everywhere.
  for (const source of [cache, room, mutations]) {
    assert.doesNotMatch(source, /noteThreadStatusMoved/);
  }
  const note = cache.slice(cache.indexOf('export function noteThreadStatusChange'));
  assert.doesNotMatch(note.slice(0, note.indexOf('\n}')), /invalidateQueries/);
  // Only status-filtered sheet entries are ever re-read, on one trailing timer.
  assert.match(cache, /const FILTERED_THREADS_REFETCH_MS = 500;/);
  assert.match(cache, /predicate: \(query\) => isStatusFilteredThreadsKey\(query\.queryKey\)/);
});

test('only a status-filtered sheet entry is re-read', () => {
  assert.equal(isStatusFilteredThreadsKey(['channels', 'threads', 'p', { mine: false, status: 'done' }, { viewerId: 1 }]), true);
  assert.equal(isStatusFilteredThreadsKey(['channels', 'threads', 'p', { mine: true, status: null }, { viewerId: 1 }]), false);
  assert.equal(isStatusFilteredThreadsKey(['channels', 'threads', 'p']), false);
});

test('a burst of status changes on one parent re-reads it once', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const runs: string[] = [];
    const schedule = createTrailingCoalescer(500, (key) => runs.push(key));
    schedule('parent-a');
    mock.timers.tick(300);
    schedule('parent-a');
    schedule('parent-b');
    mock.timers.tick(300);
    schedule('parent-a');
    assert.deepEqual(runs, []);
    mock.timers.tick(200);
    assert.deepEqual(runs, ['parent-b']);
    mock.timers.tick(300);
    assert.deepEqual(runs, ['parent-b', 'parent-a']);
  } finally {
    mock.timers.reset();
  }
});

test('choosing the status the thread already has sends nothing', () => {
  assert.equal(isSameThreadStatus('running', { value: 'running' }), true);
  assert.equal(isSameThreadStatus(null, null), true);
  assert.equal(isSameThreadStatus('done', { value: 'running' }), false);
  assert.equal(isSameThreadStatus(null, { value: 'running' }), false);
  const control = read('v2', 'features', 'channels', 'threads', 'ThreadStatusControl.tsx');
  assert.match(
    control,
    /if \(isSameThreadStatus\(next, status\)\) \{\s*close\(\);\s*return;\s*\}\s*setError\(null\);\s*mutation\.mutate\(/,
  );
});

test('a refusal re-reads the thread instead of restoring a stale snapshot', () => {
  const mutations = read('v2', 'features', 'channels', 'threads', 'mutations.ts');
  assert.match(mutations, /await queryClient\.cancelQueries\(\{\s*queryKey: channelsQueries\.detailsOf\(threadUuid\),?\s*\}\)/);
  assert.match(mutations, /const fresh = await rereadThreadStatus\(queryClient, threadUuid\);/);
});

test('screen readers hear the status and how long it has been quiet', () => {
  assert.equal(spellQuiet('quiet 1d'), 'quiet 1 day');
  assert.equal(spellQuiet('quiet 3w'), 'quiet 3 weeks');
  assert.equal(spellQuiet('quiet 2mo'), 'quiet 2 months');
  assert.equal(spellQuiet('quiet'), 'quiet');
  assert.equal(
    threadStatusTriggerLabel({ label: 'Running' }, 'quiet 1d'),
    'Status: Running, quiet 1 day. Change status',
  );
  assert.equal(threadStatusTriggerLabel({ label: 'Done' }, null), 'Status: Done. Change status');
  assert.equal(threadStatusTriggerLabel(null, null), 'Set status');
  const control = read('v2', 'features', 'channels', 'threads', 'ThreadStatusControl.tsx');
  assert.match(control, /<span className="sr-only">Status: <\/span>\s*<ThreadStatusChip/);
});

test('the phone sheet is a real radio group: one tab stop, arrows move focus only', () => {
  assert.equal(nextRadioIndex('ArrowDown', 1, 6), 2);
  assert.equal(nextRadioIndex('ArrowDown', 5, 6), 0);
  assert.equal(nextRadioIndex('ArrowUp', 0, 6), 5);
  assert.equal(nextRadioIndex('ArrowUp', -1, 6), 5);
  assert.equal(nextRadioIndex('Home', 3, 6), 0);
  assert.equal(nextRadioIndex('End', 3, 6), 5);
  const control = read('v2', 'features', 'channels', 'threads', 'ThreadStatusControl.tsx');
  assert.match(control, /role="radiogroup"\s*aria-label="Thread status"\s*onKeyDown=\{onRadioKeyDown\}/);
  assert.match(control, /tabIndex=\{selected \? 0 : -1\}/);
  // The key handler moves focus and never chooses.
  const handler = control.slice(control.indexOf('const onRadioKeyDown'));
  assert.doesNotMatch(handler.slice(0, handler.indexOf('\n  };')), /choose\(/);
});
