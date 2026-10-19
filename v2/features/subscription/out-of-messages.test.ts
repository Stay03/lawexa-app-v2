import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { IBlockedReason } from '@/types/message-pack';
import { formatResetMoment, outOfMessagesView } from './out-of-messages';

/* v2 Stage 1, item 6 (Stay approved 19 October 2026): one out-of-messages
 * notice with Upgrade plan, Buy message pack, Reactivate plan for a lapsed plan,
 * and when the messages come back, on Usage, in a chat and on New radar. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');

const block = (over: Partial<IBlockedReason> = {}): IBlockedReason => ({
  code: 'AI_MESSAGES_EXHAUSTED',
  reason: 'plan_exhausted',
  message: 'You have used all 20 messages on the Free plan.',
  plan_remaining: 0,
  payg_remaining: 0,
  resets_at: '2026-11-01T00:00:00+00:00',
  subscription_ends_at: null,
  ...over,
});

const doors = (view: ReturnType<typeof outOfMessagesView>) =>
  view.actions.map((a) => `${a.label} ${a.href}${a.primary ? ' (primary)' : ''}`);

test('a plan or free allowance spent: Upgrade plan first, then Buy message pack', () => {
  for (const reason of ['plan_exhausted', 'free_no_subscription', 'account_flagged'] as const) {
    const view = outOfMessagesView({ blocked: block({ reason }), timeZone: 'UTC' });
    assert.deepEqual(doors(view), ['Upgrade plan /pricing (primary)', 'Buy message pack /settings/message-packs'], reason);
  }
  assert.equal(outOfMessagesView({ blocked: block({ reason: 'plan_exhausted' }) }).heading, 'You’ve used your messages for now');
  assert.equal(outOfMessagesView({ blocked: block({ reason: 'account_flagged' }) }).heading, 'You’ve used your messages for now');
});

test('a free allowance has no reset time, and nothing promises one', () => {
  // Backend, 19 October 2026: the free limit is lifetime, resets_at null.
  const view = outOfMessagesView({ blocked: block({ reason: 'free_no_subscription', resets_at: null }) });
  assert.equal(view.heading, 'You’ve used your free messages');
  assert.equal(view.reset, null);
  assert.doesNotMatch(`${view.heading} ${view.reset ?? ''}`, /for now|come back|reset/i);
});

test('a lapsed plan: Reactivate plan, then Buy message pack', () => {
  const view = outOfMessagesView({ blocked: block({ reason: 'cancelled_grace_exhausted' }), timeZone: 'UTC' });
  assert.deepEqual(doors(view), ['Reactivate plan /pricing (primary)', 'Buy message pack /settings/message-packs']);
  assert.equal(view.heading, 'Your plan access has ended');
});

test('a hard limit has nothing to buy: the reset time only', () => {
  const view = outOfMessagesView({ blocked: block({ reason: 'hard_limit' }), timeZone: 'UTC' });
  assert.deepEqual(view.actions, []);
  assert.equal(view.reset, 'Your messages come back on 1 Nov 2026, 00:00.');
});

test('an unknown reason reads as a spent plan, never as "flagged"', () => {
  const view = outOfMessagesView({ blocked: block({ reason: 'something_new' as IBlockedReason['reason'] }), timeZone: 'UTC' });
  assert.deepEqual(doors(view), ['Upgrade plan /pricing (primary)', 'Buy message pack /settings/message-packs']);
  assert.doesNotMatch(JSON.stringify(view), /flag/i);
});

test('the reset line: the block’s time, else the limits’ time, else the server’s sentence, else nothing', () => {
  assert.equal(
    outOfMessagesView({ blocked: block({ resets_at: '2026-03-15T09:30:00+00:00' }), timeZone: 'Africa/Lagos' }).reset,
    'Your messages come back on 15 Mar 2026, 10:30.',
  );
  assert.equal(
    outOfMessagesView({ blocked: block({ resets_at: null }), resetsAt: '2026-03-15T09:30:00Z', timeZone: 'UTC' }).reset,
    'Your messages come back on 15 Mar 2026, 09:30.',
  );
  assert.equal(
    outOfMessagesView({ blocked: block({ resets_at: null }), resetMessage: 'Free messages do not reset.' }).reset,
    'Free messages do not reset.',
  );
  assert.equal(outOfMessagesView({ blocked: block({ resets_at: null }) }).reset, null);
  assert.equal(formatResetMoment('not a date'), null);
  assert.equal(formatResetMoment(null), null);
});

test('without a block object the words given are shown, with a spent plan’s doors', () => {
  const view = outOfMessagesView({ blocked: null, fallbackMessage: 'You are out of messages.', timeZone: 'UTC' });
  assert.equal(view.body, 'You are out of messages.');
  assert.deepEqual(doors(view), ['Upgrade plan /pricing (primary)', 'Buy message pack /settings/message-packs']);
});

test('the same notice on all four surfaces, and the chat keeps the server’s block', () => {
  assert.match(
    read('v2', 'features', 'conversations', 'conversation', 'rows', 'ErrorRow.tsx'),
    /<OutOfMessagesNotice tight blocked=\{message\.blocked\} fallbackMessage=\{message\.content\} \/>/,
  );
  assert.match(read('v2', 'shell', 'designs', 'HomeComposer.tsx'), /<OutOfMessagesNotice\s+tight\s+blocked=\{blocked\}/);
  assert.match(read('v2', 'features', 'settings', 'usage', 'UsageScreen.tsx'), /\{blocked \? <OutOfMessagesNotice blocked=\{blocked\} \/> : null\}/);
  assert.match(
    read('v2', 'features', 'radars', 'create', 'CreateRadarScreen.tsx'),
    /<OutOfMessagesNotice\s+blocked=\{reason\}\s+heading="First scan skipped — no message balance"/,
  );
  const engine = read('v2', 'runtime', 'chat-engine', 'engine.ts');
  assert.equal(engine.match(/addErrorMessage\(blocked\.message, 'MESSAGES_EXHAUSTED', false, null, blocked\);/g)?.length, 2);
  assert.match(read('types', 'chat.ts'), /blocked\?: IBlockedReason \| null;/);
});

test('a purchase refreshes the limits the notice and Usage read', () => {
  for (const file of [
    ['v2', 'features', 'settings', 'message-packs', 'PaymentCallback.tsx'],
    ['v2', 'features', 'pricing', 'PlanPaymentCallback.tsx'],
  ]) {
    const source = read(...file);
    assert.match(source, /invalidateQueries\(\{ queryKey: \['user-limits'\] \}\)/, file.join('/'));
    assert.match(source, /invalidateQueries\(\{ queryKey: usageQueries\.all \}\)/, file.join('/'));
  }
});
