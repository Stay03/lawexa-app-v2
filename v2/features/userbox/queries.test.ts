import { test } from 'node:test';
import assert from 'node:assert/strict';

import { QueryClient } from '@tanstack/query-core';
import type { UserBoxStatus } from '@/types/user-box';
import { landUserBox, landUserBoxControl, landUserBoxMode, userBoxQueries } from './queries';

/* Lawexa's machine in the cache: a write's answer, the control broadcast and
 * the live view's mode message all land in the read the panel holds, and the
 * view address survives the writes that answer without one. */

const KEY = userBoxQueries.status({ viewerId: 1 }).queryKey;
const read = (extra: Partial<UserBoxStatus> = {}): UserBoxStatus => ({
  enabled: true,
  state: 'awake',
  control: 'lawexa',
  control_reason: null,
  hand_over_message: null,
  view: { url: 'wss://userbox.test/v?token=a', expires_at: '2026-11-03T18:10:00Z' },
  ...extra,
});

function client(start: UserBoxStatus) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(KEY, start);
  return { queryClient, now: () => queryClient.getQueryData<UserBoxStatus>(KEY) };
}

test('take-over’s answer lands, and the view address the read holds is kept', () => {
  const { queryClient, now } = client(read());
  landUserBox(queryClient, { ...read({ control: 'user', control_reason: 'user_acted' }), view: null });
  assert.equal(now()?.control, 'user');
  assert.equal(now()?.view?.url, 'wss://userbox.test/v?token=a');
});

test('a hand-over broadcast shows Lawexa’s request; control back clears it', () => {
  const { queryClient, now } = client(read());
  landUserBoxControl(queryClient, { control: 'user', reason: 'hand_over', message: 'Log in, then press Done.' });
  assert.deepEqual([now()?.control, now()?.control_reason, now()?.hand_over_message], ['user', 'hand_over', 'Log in, then press Done.']);
  landUserBoxControl(queryClient, { control: 'lawexa', reason: null, message: 'stale words' });
  assert.deepEqual([now()?.control, now()?.control_reason, now()?.hand_over_message], ['lawexa', null, null]);
});

test('the view’s mode message keeps a hand-over’s request, and marks a person who acted', () => {
  const handedOver = client(read({ control: 'user', control_reason: 'hand_over', hand_over_message: 'Pay the fee.' }));
  landUserBoxMode(handedOver.queryClient, 'user');
  assert.equal(handedOver.now()?.hand_over_message, 'Pay the fee.');
  const acted = client(read());
  landUserBoxMode(acted.queryClient, 'user');
  assert.deepEqual([acted.now()?.control, acted.now()?.control_reason], ['user', 'user_acted']);
  landUserBoxMode(acted.queryClient, 'lawexa');
  assert.deepEqual([acted.now()?.control, acted.now()?.control_reason], ['lawexa', null]);
});

test('nothing is written when no panel has read the machine', () => {
  const queryClient = new QueryClient();
  landUserBoxControl(queryClient, { control: 'user', reason: 'hand_over', message: 'x' });
  assert.equal(queryClient.getQueryData(KEY), undefined);
});
