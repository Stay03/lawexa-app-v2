import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IAiMessagesLimit } from '@/types/message-pack';
import { aiMessagesView, barTone, formatUsageDate, limitView } from './model';

test('a paid plan with no plan limit but a hard cap of 999 is COUNTED, not unlimited (v1 said "Unlimited")', () => {
  // The live shape for the 63 paying accounts (21 September 2026): plan_limit
  // null, hard_limit 999, remaining is what the server resolved.
  const view = limitView({ used: 12, remaining: 987, resets_at: null });
  assert.deepEqual(view, { kind: 'counted', used: 12, total: 999, left: 987, percent: 1, resetsAt: null });
});

test('an admin with no limit at all is unlimited: remaining is null', () => {
  assert.deepEqual(limitView({ used: 40, remaining: null, resets_at: null }), { kind: 'unlimited', used: 40 });
});

test('the free plan: 7 of 10 used, with a reset date', () => {
  const view = limitView({ used: 7, remaining: 3, resets_at: '2026-10-01T00:00:00Z' });
  assert.equal(view.kind, 'counted');
  if (view.kind !== 'counted') return;
  assert.equal(view.total, 10);
  assert.equal(view.percent, 70);
  assert.equal(view.resetsAt, '2026-10-01T00:00:00Z');
});

test('a limit used up reads 100%, and a limit with nothing allowed reads 0%, not NaN', () => {
  const full = limitView({ used: 10, remaining: 0, resets_at: null });
  assert.equal(full.kind === 'counted' && full.percent, 100);
  const empty = limitView({ used: 0, remaining: 0, resets_at: null });
  assert.equal(empty.kind === 'counted' && empty.percent, 0);
});

const ai = (over: Partial<IAiMessagesLimit>): IAiMessagesLimit => ({
  limit_type: 'ai_messages',
  plan_limit: 20,
  hard_limit: null,
  used: 5,
  remaining: 15,
  resets_at: '2026-10-01T00:00:00Z',
  payg_remaining: 0,
  total_remaining: 15,
  reset_message: '',
  blocked_reason: null,
  ...over,
});

test('AI messages: the bar is the plan alone, and packs are added only to the total left', () => {
  const view = aiMessagesView(ai({}), 10);
  assert.equal(view.plan.kind === 'counted' && view.plan.percent, 25);
  assert.equal(view.packs, 10);
  assert.equal(view.totalLeft, 25);
});

test('AI messages on an unlimited plan: no total, the packs still counted', () => {
  const view = aiMessagesView(ai({ plan_limit: null, remaining: null, total_remaining: null }), 3);
  assert.equal(view.plan.kind, 'unlimited');
  assert.equal(view.totalLeft, null);
  assert.equal(view.packs, 3);
});

test('a negative pack balance never shows as fewer messages', () => {
  assert.equal(aiMessagesView(ai({}), -2).packs, 0);
});

test('the bar tone steps at 70% and 90%', () => {
  assert.deepEqual([barTone(69), barTone(70), barTone(89), barTone(90)], ['calm', 'warn', 'warn', 'alarm']);
});

test('dates read "1 Oct 2026", and a missing or broken date reads as nothing', () => {
  assert.equal(formatUsageDate('2026-10-01T12:00:00Z'), '1 Oct 2026');
  assert.equal(formatUsageDate(null), '');
  assert.equal(formatUsageDate('not a date'), '');
});
