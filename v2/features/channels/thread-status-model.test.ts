import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Message, ThreadStatus } from '@/types/collab';
import {
  THREAD_STATUS_FILTERS,
  THREAD_STATUS_OPTIONS,
  buildSetThreadStatusBody,
  channelStatusCountsLine,
  createTrailingCoalescer,
  isClosedThread,
  isSameThreadStatus,
  isStatusFilteredThreadsKey,
  knownThreadStatus,
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
  threadStatusPerson,
  threadStatusQuiet,
  threadStatusTriggerLabel,
} from './thread-status-model';

/* Thread status (Stay, 15-16 October 2026, the design "locked in" from the
 * thread-status mock; values, words and rules revised by Arthur the same day).
 * Pure rules first, then the wiring, pinned by source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

const NOW = Date.parse('2026-10-16T12:00:00Z');

function status(overrides: Partial<ThreadStatus> = {}): ThreadStatus {
  return {
    value: 'working',
    label: 'Working',
    note: null,
    changed_at: '2026-10-16T11:58:00Z',
    changed_by: { uuid: 'u1', name: 'Ada Obi' },
    via: 'app',
    is_stale: false,
    needs_action_from: null,
    ...overrides,
  };
}

const TOLU = { uuid: 'u2', name: 'Tolu' };

test('the menu offers the five statuses, in order, in Arthur’s words, and no "No status"', () => {
  assert.deepEqual(
    THREAD_STATUS_OPTIONS.map((option) => [option.value, option.label, option.hint]),
    [
      ['working', 'Working', 'Work is underway.'],
      [
        'needs_action',
        'Needs Action',
        'Someone needs to respond, review, make a decision or take the next step.',
      ],
      ['on_hold', 'On Hold', 'Work is deliberately paused.'],
      [
        'completed',
        'Completed',
        'The work is finished, but the thread may remain open for follow-up.',
      ],
      ['closed', 'Closed', 'The thread is formally concluded.'],
    ],
  );
});

test('an unknown value from the server reads as no status, never a crash', () => {
  assert.equal(knownThreadStatus(status({ value: 'paused' as never })), null);
  assert.equal(knownThreadStatus(status({ value: 'running' as never })), null, 'an old value too');
  assert.equal(knownThreadStatus(null), null);
  assert.equal(knownThreadStatus(undefined), null);
  assert.equal(knownThreadStatus(status())?.value, 'working');
  assert.equal(isClosedThread({ status: status({ value: 'paused' as never }) }), false);
  assert.equal(
    threadStatusQuiet({ status: status({ value: 'paused' as never, is_stale: true }), last_message_at: null }, NOW),
    null,
  );
});

test('Needs Action names who needs to act; no other status does', () => {
  assert.equal(threadStatusPerson(status({ value: 'needs_action', needs_action_from: TOLU })), 'Tolu');
  assert.equal(threadStatusPerson(status({ value: 'needs_action' })), null);
  assert.equal(threadStatusPerson(status({ value: 'working', needs_action_from: TOLU })), null);
  assert.equal(threadStatusPerson(null), null);
});

test('the PATCH body is built in one place, the person only with Needs Action', () => {
  assert.deepEqual(buildSetThreadStatusBody({ status: 'working' }), { status: 'working' });
  assert.deepEqual(
    buildSetThreadStatusBody({ status: 'completed', needsActionFrom: TOLU, note: 'x' }),
    { status: 'completed' },
    'a person or note on any other status would be a 422',
  );
  assert.deepEqual(
    buildSetThreadStatusBody({ status: 'needs_action', needsActionFrom: TOLU, note: ' review clause 4 ' }),
    { status: 'needs_action', note: 'review clause 4', needs_action_from: 'u2' },
  );
  assert.deepEqual(
    buildSetThreadStatusBody({ status: 'needs_action', needsActionFrom: null, note: '  ' }),
    { status: 'needs_action', note: null },
  );
});

test('the footer names who set it, an agent change names who it acted for', () => {
  assert.equal(threadStatusFooter(status(), NOW), 'Set to Working by Ada Obi · 2m ago');
  assert.equal(
    threadStatusFooter(status({ via: 'agent' }), NOW),
    'Set to Working by Lawexa for Ada Obi · 2m ago',
  );
  assert.equal(
    threadStatusFooter(status({ changed_by: null, value: 'completed' }), NOW),
    'Set to Completed · 2m ago',
  );
  assert.equal(
    threadStatusFooter(status({ changed_at: '2026-10-16T12:00:00Z' }), NOW),
    'Set to Working by Ada Obi · just now',
  );
  // Before the clock hydrates there is no age, never a wrong one.
  assert.equal(threadStatusFooter(status(), 0), 'Set to Working by Ada Obi');
});

test('only a stale Working or Needs Action thread says it has gone quiet', () => {
  const lastMessageAt = '2026-10-15T12:00:00Z';
  assert.equal(
    threadStatusQuiet({ status: status({ is_stale: true }), last_message_at: lastMessageAt }, NOW),
    'quiet 1d',
  );
  assert.equal(
    threadStatusQuiet(
      { status: status({ is_stale: true, value: 'needs_action' }), last_message_at: null },
      NOW,
    ),
    'quiet 2m',
    'no message: the age is the status change',
  );
  for (const value of ['on_hold', 'completed', 'closed'] as const) {
    assert.equal(
      threadStatusQuiet({ status: status({ is_stale: true, value }), last_message_at: lastMessageAt }, NOW),
      null,
      value,
    );
  }
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
  assert.equal(isClosedThread({ status: status({ value: 'completed' }) }), false);
  assert.equal(isClosedThread({ status: null }), false);
  assert.equal(isClosedThread({}), false);
});

test('the filter row: Any status then the five, one value on the wire', () => {
  assert.deepEqual(THREAD_STATUS_FILTERS.map(threadStatusFilterLabel), [
    'Any status',
    'Working',
    'Needs Action',
    'On Hold',
    'Completed',
    'Closed',
  ]);
  assert.equal(threadStatusFilterParam(null), undefined);
  assert.deepEqual(threadStatusFilterParam('on_hold'), ['on_hold']);
});

const COUNTS = { needs_action: 2, working: 1, on_hold: 0, completed: 4, closed: 3 };

test('filter chips carry all five counts, on All only, and never on Any status', () => {
  assert.equal(threadStatusFilterCount('needs_action', COUNTS, false), 2);
  assert.equal(threadStatusFilterCount('on_hold', COUNTS, false), 0);
  assert.equal(threadStatusFilterCount('closed', COUNTS, false), 3);
  assert.equal(threadStatusFilterCount(null, COUNTS, false), null);
  assert.equal(threadStatusFilterCount('working', COUNTS, true), null);
  assert.equal(threadStatusFilterCount('working', undefined, false), null);
});

test('a channel row shows only the Needs Action and Working counts', () => {
  assert.equal(channelStatusCountsLine(COUNTS), '2 need action · 1 working');
  assert.equal(channelStatusCountsLine({ ...COUNTS, needs_action: 1, working: 0 }), '1 needs action');
  assert.equal(channelStatusCountsLine({ ...COUNTS, needs_action: 0, working: 3 }), '3 working');
  assert.equal(channelStatusCountsLine({ ...COUNTS, needs_action: 0, working: 0 }), null);
  assert.equal(channelStatusCountsLine(undefined), null);
  const myRow = read('v2', 'features', 'channels', 'my-channels', 'MyChannelRow.tsx');
  assert.match(myRow, /channelStatusCountsLine\(channel\.thread_status_counts\)/);
  assert.match(myRow, /trail=\{statusCounts \? \[statusCounts\] : undefined\}/);
  const spaceRow = read('v2', 'features', 'spaces', 'detail', 'SpaceChannelRow.tsx');
  assert.match(spaceRow, /channelStatusCountsLine\(channel\.thread_status_counts\)/);
});

test('the filter row waits for a server that knows about statuses', () => {
  assert.equal(showsThreadStatusFilter({}, [{}, {}], null), false, 'old API: unchanged sheet');
  assert.equal(showsThreadStatusFilter({}, [{ status: null }], null), true);
  assert.equal(showsThreadStatusFilter({ thread_status_counts: COUNTS }, [], null), true);
  assert.equal(showsThreadStatusFilter({}, [], 'completed'), true, 'an empty filtered list keeps its way back');
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
          from: 'working',
          to: 'needs_action',
          note: ' review clause 4 ',
          actor_uuid: 'u1',
          actor_name: 'Ada',
          via: 'app',
          needs_action_from_uuid: 'u2',
          needs_action_from_name: 'Tolu',
        },
        'Ada set this thread to Needs Action for Tolu: review clause 4',
      ),
    ),
    {
      from: 'working',
      to: 'needs_action',
      note: 'review clause 4',
      byName: 'Ada',
      needsActionFromName: 'Tolu',
      via: 'app',
      at: '2026-10-16T14:43:00Z',
      sentence: 'Ada set this thread to Needs Action for Tolu: review clause 4',
    },
  );
  assert.equal(statusChangeOf(systemLine({ type: 'member_joined' }, 'Ada joined the channel')), null);
  assert.equal(statusChangeOf(systemLine({}, 'hello')), null);
  // A value this app does not know (an old one included): no chip.
  const unknown = statusChangeOf(
    systemLine({ type: 'thread_status_changed', to: 'running' as never }, 'Ada set this thread to Running'),
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
    threadStatusErrorText({
      message: 'The given data was invalid.',
      errors: { needs_action_from: ['Tolu cannot post in this thread.'] },
    }),
    'Tolu cannot post in this thread.',
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

test('urgency order lives in the Threads sheet only; My channels and the lobby stay by recency', () => {
  // Techlead and backend, 16 October 2026: the sheet keeps the server's
  // urgency order and never re-sorts; My channels and "Active here" keep
  // Stay's rule (20 August), the most recent on top.
  const sheet = read('v2', 'features', 'channels', 'threads', 'ThreadsSheet.tsx');
  assert.doesNotMatch(sheet, /\.sort\(|toSorted\(/);
  assert.match(sheet, /query\.data\?\.pages\.flatMap\(\(page\) => page\.data\)/);
  const myModel = read('v2', 'features', 'channels', 'my-channels', 'model.ts');
  assert.match(myModel, /return \[\.\.\.channels, \.\.\.threads\]\.sort\(compareRoomRecency\);/);
  assert.match(myModel, /const ordered = \[\.\.\.bucket\]\.sort\(compareRoomRecency\);/);
  const digest = read('v2', 'features', 'spaces', 'detail', 'activity-digest.ts');
  for (const tier of ['unread', 'rest', 'muted']) {
    assert.match(digest, new RegExp(`${tier}\\.sort\\(byRecency\\);`), tier);
  }
  assert.doesNotMatch(myModel + digest, /mergeKeepingOrder/);
  // The cache writers patch rows where they stand: no sort, no move to the top.
  const cache = read('v2', 'features', 'channels', 'cache.ts');
  const writer = cache.slice(cache.indexOf('export function applyThreadStatus'));
  const body = writer.slice(0, writer.search(/\n\}\r?\n/));
  assert.doesNotMatch(body, /\.sort\(|unshift|\[\s*(row|next),\s*\.\.\./);
  assert.match(body, /\.map\(\(row\) =>/);
});

test('old status values never appear in the status UI code', () => {
  for (const parts of [
    ['v2', 'features', 'channels', 'thread-status-model.ts'],
    ['v2', 'features', 'collab', 'kit', 'ThreadStatusChip.tsx'],
    ['v2', 'features', 'channels', 'threads', 'ThreadStatusControl.tsx'],
    ['v2', 'features', 'channels', 'threads', 'NeedsActionStep.tsx'],
    ['v2', 'features', 'channels', 'threads', 'ThreadsSheet.tsx'],
  ]) {
    assert.doesNotMatch(
      read(...parts),
      /'(running|waiting|blocked|done)'|\b(Running|Waiting|Blocked)\b/,
      parts.join('/'),
    );
  }
});

/* ── Wiring ────────────────────────────────────────────────────────────── */

test('every thread list draws the chip, with its person, after the title, and greys a Closed title', () => {
  for (const parts of [
    ['v2', 'features', 'channels', 'threads', 'ThreadsSheet.tsx'],
    ['v2', 'features', 'spaces', 'detail', 'SpaceThreadRow.tsx'],
    ['v2', 'features', 'channels', 'my-channels', 'MyThreadRow.tsx'],
  ]) {
    const row = read(...parts);
    assert.match(row, /\{title\}\s*<\/span>[\s\S]{0,400}<ThreadStatusChip\b/, parts.join('/'));
    assert.match(row, /const status = knownThreadStatus\(thread\.status\);/, parts.join('/'));
    assert.match(row, /person=\{threadStatusPerson\(status\)\}/, parts.join('/'));
    assert.match(row, /isClosedThread\(thread\)/, parts.join('/'));
    assert.match(row, /threadStatusQuiet\(thread, now\)/, parts.join('/'));
  }
});

test('Needs Action stands out: a filled amber pill where the others are tinted', () => {
  const chip = read('v2', 'features', 'collab', 'kit', 'ThreadStatusChip.tsx');
  assert.match(chip, /needs_action: \{\s*chip: 'bg-amber-400 text-amber-950/);
  assert.match(chip, /working: \{\s*chip: 'bg-blue-500\/12/);
  assert.match(chip, /on_hold: \{\s*chip: 'bg-slate-500\/12/);
  assert.match(chip, /completed: \{\s*chip: 'bg-emerald-500\/12/);
  assert.doesNotMatch(chip, /animate-|shadow-/);
  assert.match(chip, /if \(!isThreadStatusValue\(value\)\) return null;/);
  assert.match(chip, /\{`· \$\{person\}`\}/);
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
  assert.match(screen, /isThread && channel\.status !== undefined \? knownThreadStatus\(channel\.status\)/);
  assert.match(screen, /canSet=\{canParticipate\}/);
  const header = read('v2', 'features', 'channels', 'screen', 'PlaceHeader.tsx');
  // One of each, each shown at its own width only.
  assert.match(header, /flex min-w-0 flex-1 items-center gap-2 md:hidden">/);
  assert.match(header, /data-desktop-status-line className="flex min-w-0 items-center">\s*\{renderStatus\('menu'\)\}/);
});

test('on a phone a thread with a status line takes the room of the faces, Members staying in the menu', () => {
  const header = read('v2', 'features', 'channels', 'screen', 'PlaceHeader.tsx');
  assert.match(header, /<div className=\{cn\('shrink-0', renderStatus && menu && 'hidden md:block'\)\}>\s*\{presence !== null && onOpenRoster/);
  const screen = read('v2', 'features', 'channels', 'screen', 'ChannelScreen.tsx');
  // The menu that stands in for the faces carries Members.
  assert.match(screen, /const channelMenu = canParticipate \?[\s\S]*?panel\.show\('members'\)[\s\S]*?\) : undefined;/);
});

test('on a wide pane the status has its own line under the name, as on a phone', () => {
  // Techlead, 16 October 2026: a Needs Action chip beside the name cut it to
  // "Te…", and Needs Action must name who acts, so the name keeps its row.
  const header = read('v2', 'features', 'channels', 'screen', 'PlaceHeader.tsx');
  assert.match(header, /<div className="hidden min-w-0 flex-1 flex-col justify-center gap-0\.5 md:flex">\s*<div className="flex min-w-0 items-center gap-2">/);
  // The status line follows the name's row, never inside it.
  assert.match(header, /<\/Link>\s*<\/div>\s*\{\/\* The thread's status, under its name, `md:` and up\. \*\/\}\s*\{renderStatus && \(\s*<div data-desktop-status-line/);
  assert.equal(header.match(/renderStatus\('menu'\)/g)?.length, 1);
});

test('the header status trims only its quiet suffix, never the word or the person', () => {
  // The techlead's pictures, 16 October 2026: on a phone "· quiet 1d" ran
  // under the faces. The header's chip fits; a row's stays whole.
  const control = read('v2', 'features', 'channels', 'threads', 'ThreadStatusControl.tsx');
  assert.equal(control.match(/\bfit\b\s*\/>/g)?.length, 2);
  // The floor is the word: no box from the header down to the chip may take
  // `min-w-0`, or the pill shrinks under its own label.
  assert.match(control, /'v2-interactive inline-flex items-center gap-1 rounded-full pr-1\.5'/);
  assert.match(control, /<span className="inline-flex items-center">\s*<span className="sr-only">Status: <\/span>/);
  const chip = read('v2', 'features', 'collab', 'kit', 'ThreadStatusChip.tsx');
  assert.match(chip, /fit = false/);
  assert.match(chip, /const FIT_GRID = 'inline-grid grid-cols-\[auto_minmax\(0,max-content\)\]';/);
  assert.match(chip, /fit \? FIT_GRID : 'inline-flex shrink-0'/);
  assert.match(chip, /fit && 'min-w-0 truncate'/);
  assert.match(chip, /<span className="min-w-0 max-w-32 truncate">\{`· \$\{person\}`\}<\/span>/);
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
  // The phone's trigger is the row chip, no taller than it, and the note
  // follows it on the same line.
  const control = read('v2', 'features', 'channels', 'threads', 'ThreadStatusControl.tsx');
  assert.match(
    control,
    /className=\{TRIGGER_COMPACT\}\s*>\s*<TriggerFace status=\{status\} quiet=\{quiet\} compact \/>\s*<\/button>\s*<PhoneNote status=\{status\} \/>/,
  );
});

test('the menu has no clear item, and Needs Action asks who before it saves', () => {
  const control = read('v2', 'features', 'channels', 'threads', 'ThreadStatusControl.tsx');
  assert.doesNotMatch(control, /'No status'|choose\(null\)|status: null/);
  assert.match(control, /if \(value === 'needs_action'\) openNeedsAction\(\);\s*else choose\(\{ status: value \}\);/);
  assert.match(control, /choose\(\{ status: 'needs_action', needsActionFrom: person, note \}\)/);
  assert.equal(control.match(/<NeedsActionStep\b/g)?.length, 2, 'in the menu and in the sheet');
  const step = read('v2', 'features', 'channels', 'threads', 'NeedsActionStep.tsx');
  assert.match(step, /Who needs to act\?/);
  assert.match(step, /\(optional\)/);
  // The parent channel's members, through the shared roster cache entry.
  assert.match(step, /channelsQueries\.members\(parentUuid \?\? '', \{ viewerId \}\)/);
  assert.match(step, /enabled: parentUuid !== null/);
  assert.match(step, /maxLength=\{NOTE_MAX\}/);
  assert.match(step, /const NOTE_MAX = 140;/);
  const mutations = read('v2', 'features', 'channels', 'threads', 'mutations.ts');
  assert.match(mutations, /channelsApi\.setStatus\(threadUuid, buildSetThreadStatusBody\(choice\)\)/);
});

/* ── Checker round 2 (16 October 2026) ─────────────────────────────────── */

test('the desktop control is a modal popover, not a menu, so the step is reachable by keyboard', () => {
  const control = read('v2', 'features', 'channels', 'threads', 'ThreadStatusControl.tsx');
  assert.doesNotMatch(control, /<DropdownMenu|ui\/dropdown-menu'/);
  assert.match(control, /<Popover\s+modal\b/);
  assert.match(control, /<PopoverTrigger\b/);
  assert.match(control, /<PopoverContent\b/);
  // Both surfaces draw the same radio group of the five.
  assert.equal(control.match(/<StatusRadioGroup\b/g)?.length, 2);
  // The step takes focus when it arrives, through a STABLE callback ref, so
  // typing in the note never pulls focus back to the search box.
  const step = read('v2', 'features', 'channels', 'threads', 'NeedsActionStep.tsx');
  assert.match(step, /const focusOnArrive = useCallback\(\(node: HTMLElement \| null\) => \{\s*node\?\.focus\(\);\s*\}, \[\]\);/);
  assert.match(step, /<Input\s+ref=\{focusOnArrive\}/);
  assert.match(step, /ref=\{parentUuid === null \? focusOnArrive : undefined\}/);
  assert.doesNotMatch(step, /stopPropagation/);
});

test('the member picker is a real radio group led by "No one in particular"', () => {
  const step = read('v2', 'features', 'channels', 'threads', 'NeedsActionStep.tsx');
  assert.match(step, /const NO_ONE = 'No one in particular';/);
  assert.match(step, /\{ uuid: null, name: NO_ONE \},\s*\.\.\.people,/);
  assert.match(step, /role="radiogroup"\s*aria-labelledby="v2-needs-action-title"\s*onKeyDown=\{moveRadioFocus\}/);
  assert.match(step, /const tabStop = chosenVisible \? selected : index === 0;/);
  assert.match(step, /tabIndex=\{tabStop \? 0 : -1\}/);
  // A tap chooses; it never un-chooses (the old second-tap toggle is gone).
  assert.doesNotMatch(step, /selected \? null/);
});

test('the member search asks the server after a pause, with the first page as the fallback', () => {
  const step = read('v2', 'features', 'channels', 'threads', 'NeedsActionStep.tsx');
  assert.match(step, /const SEARCH_DEBOUNCE_MS = 250;/);
  // Debounced in the change handler, never in an effect.
  assert.match(step, /setDebounced\(next\.trim\(\)\);\s*\}, SEARCH_DEBOUNCE_MS\);/);
  assert.match(step, /onChange=\{\(event\) => onSearchChange\(event\.target\.value\)\}/);
  assert.match(step, /channelsQueries\.members\(parentUuid \?\? '', \{ viewerId, search: debounced \}\)/);
  assert.match(step, /enabled: parentUuid !== null && debounced !== ''/);
  assert.match(step, /if \(typed !== '' && debounced === typed && searched\.data\)/);
  const api = read('lib', 'api', 'collab.ts');
  assert.match(api, /`\/channels\/\$\{uuid\}\/members`,\s*\{\s*params: \{\s*search: params\.search \|\| undefined,/);
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
  assert.deepEqual(shiftThreadStatusCounts(COUNTS, 'needs_action', 'completed'), {
    needs_action: 1,
    working: 1,
    on_hold: 0,
    completed: 5,
    closed: 3,
  });
  assert.equal(shiftThreadStatusCounts(COUNTS, null, 'on_hold').on_hold, 1);
  assert.equal(shiftThreadStatusCounts(COUNTS, 'working', null).working, 0);
  assert.equal(shiftThreadStatusCounts(COUNTS, 'closed', 'closed'), COUNTS, 'no move, same object');
  assert.equal(shiftThreadStatusCounts(COUNTS, 'on_hold', null).on_hold, 0, 'never below zero');
  assert.equal(
    shiftThreadStatusCounts(COUNTS, 'running' as never, 'working').working,
    2,
    'an unknown old value is not counted',
  );

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
  assert.equal(isStatusFilteredThreadsKey(['channels', 'threads', 'p', { mine: false, status: 'completed' }, { viewerId: 1 }]), true);
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

test('choosing what the thread already holds sends nothing', () => {
  assert.equal(isSameThreadStatus({ status: 'working' }, status()), true);
  assert.equal(isSameThreadStatus({ status: 'completed' }, status()), false);
  assert.equal(isSameThreadStatus({ status: 'working' }, null), false);
  const needs = status({ value: 'needs_action', needs_action_from: TOLU, note: 'review' });
  assert.equal(
    isSameThreadStatus({ status: 'needs_action', needsActionFrom: TOLU, note: ' review ' }, needs),
    true,
  );
  assert.equal(
    isSameThreadStatus({ status: 'needs_action', needsActionFrom: null, note: 'review' }, needs),
    false,
    'a different person is a change',
  );
  assert.equal(
    isSameThreadStatus({ status: 'needs_action', needsActionFrom: TOLU, note: null }, needs),
    false,
    'a different note is a change',
  );
  const control = read('v2', 'features', 'channels', 'threads', 'ThreadStatusControl.tsx');
  assert.match(
    control,
    /if \(isSameThreadStatus\(choice, status\)\) \{\s*close\(\);\s*return;\s*\}\s*setError\(null\);\s*mutation\.mutate\(/,
  );
});

test('a refusal re-reads the thread instead of restoring a stale snapshot', () => {
  const mutations = read('v2', 'features', 'channels', 'threads', 'mutations.ts');
  assert.match(mutations, /await queryClient\.cancelQueries\(\{\s*queryKey: channelsQueries\.detailsOf\(threadUuid\),?\s*\}\)/);
  assert.match(mutations, /const fresh = await rereadThreadStatus\(queryClient, threadUuid\);/);
});

test('screen readers hear the status, its person and how long it has been quiet', () => {
  assert.equal(spellQuiet('quiet 1d'), 'quiet 1 day');
  assert.equal(spellQuiet('quiet 3w'), 'quiet 3 weeks');
  assert.equal(spellQuiet('quiet 2mo'), 'quiet 2 months');
  assert.equal(spellQuiet('quiet'), 'quiet');
  assert.equal(
    threadStatusTriggerLabel(status(), 'quiet 1d'),
    'Status: Working, quiet 1 day. Change status',
  );
  assert.equal(
    threadStatusTriggerLabel(status({ value: 'needs_action', needs_action_from: TOLU }), null),
    'Status: Needs Action, Tolu. Change status',
  );
  assert.equal(threadStatusTriggerLabel(status({ value: 'completed' }), null), 'Status: Completed. Change status');
  assert.equal(threadStatusTriggerLabel(null, null), 'Set status');
  const control = read('v2', 'features', 'channels', 'threads', 'ThreadStatusControl.tsx');
  assert.match(control, /<span className="sr-only">Status: <\/span>\s*<ThreadStatusChip/);
});

test('the status list is a real radio group on both surfaces: one tab stop, arrows move focus only', () => {
  assert.equal(nextRadioIndex('ArrowDown', 1, 5), 2);
  assert.equal(nextRadioIndex('ArrowDown', 4, 5), 0);
  assert.equal(nextRadioIndex('ArrowUp', 0, 5), 4);
  assert.equal(nextRadioIndex('ArrowUp', -1, 5), 4);
  assert.equal(nextRadioIndex('Home', 3, 5), 0);
  assert.equal(nextRadioIndex('End', 3, 5), 4);
  const control = read('v2', 'features', 'channels', 'threads', 'ThreadStatusControl.tsx');
  assert.match(control, /role="radiogroup"\s*aria-label="Thread status"\s*onKeyDown=\{moveRadioFocus\}/);
  // The checked option is the tab stop; with no status, the first one.
  assert.match(control, /const tabStop = current === null \? index === 0 : selected;/);
  assert.match(control, /tabIndex=\{tabStop \? 0 : -1\}/);
  // The key handler moves focus and never chooses.
  const handler = read('v2', 'features', 'channels', 'threads', 'radio-focus.ts');
  assert.match(handler, /radios\[target\]\?\.focus\(\);/);
  assert.doesNotMatch(handler, /choose\(|press\(|click\(/);
});
