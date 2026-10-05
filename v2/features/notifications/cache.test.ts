import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
} from '@/types/notification';
import {
  adjustUnreadCount,
  flattenUnique,
  listFilterOf,
  reinsertRow,
  removeRow,
  revertRead,
  stampAllRead,
  stampRead,
  unstampAllRead,
  zeroUnreadCount,
  type NotificationPages,
} from './cache';
import { notificationsQueries } from './queries';

const READ_AT = '2026-10-05T10:00:00.000Z';

function note(id: string, readAt: string | null = null): Notification {
  return {
    id,
    type: 'ChannelMentionNotification',
    title: `Row ${id}`,
    message: null,
    action_url: null,
    icon: 'mention',
    read_at: readAt,
    created_at: '2026-10-04T23:39:16+00:00',
  };
}

function page(rows: Notification[], currentPage: number, total: number): NotificationListResponse {
  return {
    success: true,
    message: 'Notifications retrieved successfully.',
    data: rows,
    pagination: {
      current_page: currentPage,
      per_page: 20,
      total,
      last_page: 3,
      from: 1,
      to: rows.length,
    },
    links: { first: '', last: '', prev: null, next: null },
  };
}

/** Two loaded pages: a, b (read), c on page 1; d, e on page 2. Total 5. */
function stream(): NotificationPages {
  return {
    pages: [
      page([note('a'), note('b', '2026-10-01T00:00:00+00:00'), note('c')], 1, 5),
      page([note('d'), note('e')], 2, 5),
    ],
    pageParams: [1, 2],
  };
}

const ids = (data: NotificationPages) => data.pages.map((p) => p.data.map((row) => row.id));
const totals = (data: NotificationPages) => data.pages.map((p) => p.pagination.total);

test('the bell and the page share one All key, and each filter has its own', () => {
  assert.deepEqual(
    notificationsQueries.infiniteList().queryKey,
    notificationsQueries.infiniteList({}).queryKey,
  );
  assert.notDeepEqual(
    notificationsQueries.infiniteList().queryKey,
    notificationsQueries.infiniteList({ read: 'unread' }).queryKey,
  );
});

test('a stream key says which filter it was fetched with', () => {
  assert.equal(listFilterOf(notificationsQueries.infiniteList().queryKey), null);
  assert.equal(listFilterOf(notificationsQueries.infiniteList({ read: 'unread' }).queryKey), 'unread');
  assert.equal(listFilterOf(notificationsQueries.infiniteList({ read: 'read' }).queryKey), 'read');
  assert.equal(listFilterOf(['notifications', 'list', 'infinite']), null);
});

test('marking read in the All stream stamps the row in place', () => {
  const data = stream();
  const { next, undo } = stampRead(data, 'd', READ_AT, null);
  assert.equal(next.pages[1].data[0].read_at, READ_AT);
  assert.deepEqual(ids(next), ids(data));
  assert.deepEqual(undo, { kind: 'unstamp', id: 'd', readAt: READ_AT });
  assert.equal(next.pages[0], data.pages[0], 'an untouched page keeps its reference');
});

test('marking an already-read row changes nothing and returns the same object', () => {
  const data = stream();
  const { next, undo } = stampRead(data, 'b', READ_AT, null);
  assert.equal(next, data);
  assert.equal(undo, null);
  assert.equal(stampRead(data, 'zz', READ_AT, null).next, data);
});

test('marking read in the Unread stream takes the row out and lowers the total', () => {
  const data = stream();
  const { next, undo } = stampRead(data, 'c', READ_AT, 'unread');
  assert.deepEqual(ids(next), [['a', 'b'], ['d', 'e']]);
  assert.deepEqual(totals(next), [4, 4]);
  assert.equal(undo?.kind, 'reinsert');
});

test('marking read leaves a Read stream for its refetch', () => {
  const data = stream();
  const { next, undo } = stampRead(data, 'a', READ_AT, 'read');
  assert.equal(next, data);
  assert.equal(undo, null);
});

test('a failed mark-read is undone exactly, in either stream', () => {
  const data = stream();
  const all = stampRead(data, 'a', READ_AT, null);
  assert.deepEqual(revertRead(all.next, all.undo!), data);

  const unread = stampRead(data, 'd', READ_AT, 'unread');
  assert.deepEqual(revertRead(unread.next, unread.undo!), data);
});

test('an undo clears only our own stamp, never the server’s', () => {
  const data = stream();
  const { next, undo } = stampRead(data, 'a', READ_AT, null);
  const refetched: NotificationPages = {
    ...next,
    pages: next.pages.map((p, i) =>
      i === 0
        ? { ...p, data: p.data.map((row) => (row.id === 'a' ? { ...row, read_at: '2026-10-05T10:00:00+00:00' } : row)) }
        : p,
    ),
  };
  assert.equal(revertRead(refetched, undo!), refetched);
});

test('mark all stamps every unread row in the All stream', () => {
  const next = stampAllRead(stream(), READ_AT, null);
  const reads = next.pages.flatMap((p) => p.data.map((row) => row.read_at));
  assert.deepEqual(reads, [READ_AT, '2026-10-01T00:00:00+00:00', READ_AT, READ_AT, READ_AT]);
});

test('mark all empties the Unread stream to one last, empty page', () => {
  const next = stampAllRead(stream(), READ_AT, 'unread');
  assert.equal(next.pages.length, 1);
  assert.deepEqual(next.pages[0].data, []);
  assert.equal(next.pages[0].pagination.total, 0);
  assert.equal(next.pages[0].pagination.last_page, 1);
  assert.deepEqual(next.pageParams, [1]);
});

test('mark all leaves a Read stream and an already-read stream alone', () => {
  const data = stream();
  assert.equal(stampAllRead(data, READ_AT, 'read'), data);
  const allRead = stampAllRead(data, READ_AT, null);
  assert.equal(stampAllRead(allRead, '2026-10-05T11:00:00.000Z', null), allRead);
});

test('a failed mark-all clears exactly its own stamps', () => {
  const data = stream();
  assert.deepEqual(unstampAllRead(stampAllRead(data, READ_AT, null), READ_AT), data);
});

test('remove then reinsert puts the row back where it was, across pages', () => {
  const data = stream();
  for (const id of ['a', 'c', 'd', 'e']) {
    const { next, removed } = removeRow(data, id);
    assert.ok(removed, id);
    assert.deepEqual(totals(next), [4, 4]);
    assert.deepEqual(reinsertRow(next, removed), data, id);
  }
});

test('removing a row the stream does not hold returns the same object', () => {
  const data = stream();
  const { next, removed } = removeRow(data, 'zz');
  assert.equal(next, data);
  assert.equal(removed, null);
});

test('two removals roll back independently, never resurrecting each other', () => {
  const data = stream();
  const first = removeRow(data, 'a');
  const second = removeRow(first.next, 'd');
  // Only the first delete fails: `d` must stay gone.
  const rolledBack = reinsertRow(second.next, first.removed!);
  assert.deepEqual(ids(rolledBack), [['a', 'b', 'c'], ['e']]);
});

test('a reinsert is skipped when the row is already back or its page is gone', () => {
  const data = stream();
  const { removed } = removeRow(data, 'd');
  assert.equal(reinsertRow(data, removed!), data);
  const shrunk: NotificationPages = { pages: [data.pages[0]], pageParams: [1] };
  assert.equal(reinsertRow(shrunk, removed!), shrunk);
});

test('the unread count moves by a delta and never goes below zero', () => {
  const count = (n: number): UnreadCountResponse => ({
    success: true,
    message: '',
    data: { unread_count: n },
  });
  assert.equal(adjustUnreadCount(count(3), -1)?.data.unread_count, 2);
  assert.equal(adjustUnreadCount(count(0), -1)?.data.unread_count, 0);
  assert.equal(adjustUnreadCount(undefined, -1), undefined);
  assert.equal(zeroUnreadCount(count(7))?.data.unread_count, 0);
  const zero = count(0);
  assert.equal(zeroUnreadCount(zero), zero);
});

test('flattening keeps the first copy of a row that two pages both carry', () => {
  const first = page([note('a'), note('b')], 1, 4);
  const second = page([{ ...note('b'), title: 'stale copy' }, note('c')], 2, 4);
  const rows = flattenUnique([first, second]);
  assert.deepEqual(rows.map((row) => row.id), ['a', 'b', 'c']);
  assert.equal(rows[1].title, 'Row b');
  assert.deepEqual(flattenUnique(undefined), []);
});
