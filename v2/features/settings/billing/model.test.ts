import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ICurrentSubscriptionData, IPlan, ISubscription } from '@/types/subscription';
import { CANCEL_DETAILS_MAX, CANCEL_REASONS, cancelReasonReady, summarisePlan } from './model';

const plan = (over: Partial<IPlan> = {}): IPlan =>
  ({
    id: 7, name: 'Pro', slug: 'pro', slug_base: 'pro', description: null, amount: '5000.00',
    amount_minor: 500000, formatted_amount: '₦5,000', currency: 'NGN', provider: 'paystack',
    interval: 'monthly', interval_label: 'Monthly', interval_count: 1, is_free: false, is_featured: false,
    ...over,
  }) as IPlan;

const sub = (over: Partial<ISubscription>): ISubscription =>
  ({
    id: 1, plan: plan(), status: 'active', status_label: 'Active', amount: '5000.00', currency: 'NGN',
    provider: 'paystack', start_date: '2026-09-01T00:00:00Z', next_payment_date: '2026-10-01T00:00:00Z',
    cancelled_at: null, ends_at: null, days_until_renewal: 3, is_in_grace_period: false, has_access: true,
    created_at: '2026-09-01T00:00:00Z',
    ...over,
  }) as ISubscription;

const data = (subscription: ISubscription | null, free = false): ICurrentSubscriptionData => ({
  subscription,
  plan: free ? plan({ name: 'Free', is_free: true, formatted_amount: 'Free' }) : plan(),
  is_free_tier: free,
});

test('the free tier: "Free plan", nothing to cancel (the live answer for this account)', () => {
  const s = summarisePlan(data(null, true), null);
  assert.equal(s.detail, 'Free plan');
  assert.equal(s.cancel, null);
  assert.equal(s.isFree, true);
});

test('an active plan shows its price per month and its renewal date', () => {
  const s = summarisePlan(data(sub({})), null);
  assert.equal(s.detail, '₦5,000 a month · renews 1 October 2026');
  assert.equal(s.cancel, 'subscription');
});

test('a single paid period says it covers one month and when it ends, with nothing to cancel', () => {
  const s = summarisePlan(data(sub({ renews: false, ends_at: '2026-11-01T00:00:00Z' })), null);
  assert.equal(s.detail, '₦5,000 a month · ends 1 November 2026');
  assert.equal(
    s.note?.text,
    'This payment covers one month. Ends 1 November 2026. Pay again to continue, or pay by card or direct debit for automatic renewal.',
  );
  assert.equal(s.cancel, null);
});

test('a plan from a server without the renews field still reads as renewing', () => {
  const s = summarisePlan(data(sub({ ends_at: '2026-11-01T00:00:00Z' })), null);
  assert.equal(s.detail, '₦5,000 a month · renews 1 October 2026');
  assert.equal(s.cancel, 'subscription');
});

test('a cancelled plan has nothing left to cancel and says when it ends', () => {
  const s = summarisePlan(data(sub({ status: 'cancelled', ends_at: '2026-10-01T00:00:00Z' })), null);
  assert.equal(s.detail, 'Cancelled · ends 1 October 2026');
  assert.equal(s.cancel, null);
});

test('a trial is cancelled as a trial, not as a subscription', () => {
  const s = summarisePlan(data(sub({ status: 'trialing' })), null);
  assert.equal(s.cancel, 'trial');
});

test('an overdue payment raises an alarm note', () => {
  const s = summarisePlan(data(sub({ status: 'past_due' })), null);
  assert.equal(s.note?.tone, 'alarm');
});

/* "Why are you cancelling?" (Arthur, 28 October 2026, "B plus A"). */
test('the four reasons are Arthur’s, and only Other needs words, within 2,000', () => {
  assert.deepEqual(
    CANCEL_REASONS.map((reason) => [reason.key, reason.label]),
    [
      ['too_expensive', 'Too expensive'],
      ['not_used_enough', 'Didn’t use it enough'],
      ['missing_something', 'Missing something I need'],
      ['other', 'Other'],
    ],
  );
  assert.equal(CANCEL_DETAILS_MAX, 2000);
  assert.equal(cancelReasonReady(null, 'anything'), false);
  assert.equal(cancelReasonReady('too_expensive', ''), true);
  assert.equal(cancelReasonReady('other', '   '), false);
  assert.equal(cancelReasonReady('other', 'I moved firms'), true);
  assert.equal(cancelReasonReady('missing_something', 'x'.repeat(2001)), false);
});

test('a paid cancel asks why in the same dialog; a trial asks nothing; Skip or closing ends it', () => {
  const dialog = readFileSync(join(process.cwd(), 'v2', 'features', 'settings', 'billing', 'CancelPlanDialog.tsx'), 'utf8');
  // The question comes only after the cancel succeeded.
  assert.match(dialog, /toast\.success\(response\.message \|\| \(isTrial \? 'Trial cancelled' : 'Plan cancelled'\)\);\s*if \(isTrial\) close\(\);\s*else setAsking\(true\);/);
  assert.match(dialog, /\{asking \? \(\s*<CancelReasonStep onDone=\{close\} \/>/);
  // Already told us (409), or no cancelled plan (422 with no field errors): done.
  assert.match(dialog, /if \(status === 409 \|\| \(status === 422 && !errors\)\) onDone\(\);/);
  assert.match(dialog, />\s*Skip\s*<\/Button>/);
  const api = readFileSync(join(process.cwd(), 'lib', 'api', 'subscriptions.ts'), 'utf8');
  assert.match(api, /apiClient\.post<ApiResponse<unknown>>\('\/subscriptions\/cancellation-feedback', \{\s*reason: body\.reason,\s*\.\.\.\(body\.details \? \{ details: body\.details \} : \{\}\),/);
});
