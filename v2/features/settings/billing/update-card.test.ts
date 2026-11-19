import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ICurrentSubscriptionData, IPlan, ISubscription } from '@/types/subscription';
import { summarisePlan, updateCardEmphasis, updateCardFailure } from './model';

/* "Update card" on Billing (Arthur, 18 November 2026; Backend's
 * GET /subscriptions/manage-link). TEST DATA. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8').replace(/\r\n/g, '\n');
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

test('only a card-paid plan that renews offers Update card; an overdue one shows it first', () => {
  assert.equal(updateCardEmphasis(data(sub({}))), 'quiet');
  assert.equal(updateCardEmphasis(data(sub({ status: 'past_due' }))), 'prominent');
  assert.equal(updateCardEmphasis(data(sub({ provider: 'flutterwave' }))), null, 'not a Paystack plan');
  assert.equal(updateCardEmphasis(data(sub({ status: 'cancelled' }))), null);
  assert.equal(updateCardEmphasis(data(sub({ status: 'expired' }))), null);
  assert.equal(updateCardEmphasis(data(sub({ status: 'trialing' }))), null);
  assert.equal(updateCardEmphasis(data(null, true)), null, 'the free tier');
  assert.equal(
    updateCardEmphasis(data(sub({ renews: false, ends_at: '2026-10-01T00:00:00Z' }))),
    null,
    'a single paid period never charges again',
  );
});

test('an overdue card-paid plan says to update the card; any other overdue plan keeps the old sentence', () => {
  assert.equal(
    summarisePlan(data(sub({ status: 'past_due' })), null).note?.text,
    'Your last payment did not go through. Update your card to keep your plan.',
  );
  assert.equal(
    summarisePlan(data(sub({ status: 'past_due', provider: 'flutterwave' })), null).note?.text,
    'Your last payment did not go through. Choose a plan again, or contact support.',
  );
});

test('a failure says why, in the server’s words where it gave them', () => {
  assert.equal(updateCardFailure(404, 'You have no card-paid subscription to update.'), 'You have no card-paid subscription to update.');
  assert.equal(updateCardFailure(404, undefined), 'You have no card-paid subscription to update.');
  assert.equal(
    updateCardFailure(502, 'The card page could not be opened just now. Try again in a moment.'),
    'The card page could not be opened just now. Try again in a moment.',
  );
  assert.equal(updateCardFailure(429, 'Too Many Attempts.'), 'Too many tries. Try again in a minute.');
  assert.equal(updateCardFailure(500, 'Server Error'), 'The card page could not be opened. Try again.');
  assert.equal(updateCardFailure(undefined, undefined), 'The card page could not be opened. Try again.');
});

test('the wiring: a fresh link per tap, the tab opened at the tap, a 404 reads the plan again', () => {
  const api = read('lib', 'api', 'subscriptions.ts');
  assert.match(api, /apiClient\.get<ApiResponse<ManageLinkData>>\('\/subscriptions\/manage-link'\)/);
  const queries = read('v2', 'features', 'settings', 'billing', 'queries.ts');
  assert.match(queries, /const tab = window\.open\('', '_blank'\);\n\s+fetchLink\.mutate\(/, 'the tab opens before the request');
  assert.match(queries, /tab\.opener = null;\n\s+tab\.location\.href = link;/);
  assert.match(queries, /if \(status === 404\) void queryClient\.invalidateQueries\(\{ queryKey: billingQueries\.all \}\);/);
  assert.doesNotMatch(queries, /useQuery\([^)]*getManageLink/, 'the link is never cached in a query');
  const screen = read('v2', 'features', 'settings', 'billing', 'BillingScreen.tsx');
  assert.match(screen, /\{cardEmphasis \? \([\s\S]{0,600}onClick=\{updateCard\.open\}[\s\S]{0,1600}Update card<\/span>/);
  assert.ok(screen.indexOf('Update card</span>') < screen.indexOf("'Cancel free trial' : 'Cancel plan'"), 'above Cancel plan');
});
