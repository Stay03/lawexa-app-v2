import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ICurrentSubscriptionData, IPlan, ISubscription } from '@/types/subscription';
import { summarisePlan } from './model';

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
