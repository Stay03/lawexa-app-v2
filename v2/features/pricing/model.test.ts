import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ICurrentSubscriptionData, IPlan, IPlanLimit, ISubscription } from '@/types/subscription';
import {
  accountNotices,
  actionLabel,
  buildTiers,
  cardLines,
  currenciesOnSale,
  defaultPeriod,
  isCurrentTier,
  limitLines,
  periodsOnSale,
  planAction,
  planFor,
  priceView,
  savingHint,
  tierBenefits,
  tierKey,
  tierName,
  tierSaving,
} from './model';

const counted = (type: IPlanLimit['type'], value: number, period: IPlanLimit['period'] = 'billing_interval'): IPlanLimit => ({
  type, value, is_unlimited: false, period,
});
const unlimited = (type: IPlanLimit['type']): IPlanLimit => ({ type, value: -1, is_unlimited: true, period: 'lifetime' });

const plan = (over: Partial<IPlan> = {}): IPlan => ({
  id: 80, name: 'Basic Monthly USD', slug: 'basic-monthly-usd', slug_base: 'basic-monthly',
  description: 'Best for students and light users', amount: '9.99', amount_minor: 999,
  formatted_amount: 'USD 9.99', currency: 'USD', provider: 'paystack', interval: 'monthly',
  interval_label: 'Monthly', interval_count: 1, is_free: false, is_featured: false, trial_eligible: false,
  features: [], limits: [counted('ai_messages', 50), unlimited('bookmarks'), unlimited('note_creations')],
  ...over,
});

// The eight USD plans and the free plan, as `/subscriptions/plans` returned
// them on 5 October 2026, in the server's order.
const LIVE: IPlan[] = [
  plan({ id: 4, name: 'Free', slug: 'free', slug_base: 'free', amount_minor: 0, currency: 'NGN', is_free: true }),
  plan({ id: 75, name: 'AI Counsel Annually USD', slug_base: 'ai-counsel-annually', interval: 'annually', interval_label: 'Annually', amount_minor: 249900, limits: [unlimited('ai_messages')] }),
  plan({ id: 76, name: 'AI Counsel Monthly USD', slug_base: 'ai-counsel-monthly', amount_minor: 24999, limits: [unlimited('ai_messages')] }),
  plan({ id: 77, name: 'Pro Annually USD', slug_base: 'pro-annually', interval: 'annually', interval_label: 'Annually', amount_minor: 49999, limits: [counted('ai_messages', 200)] }),
  plan({ id: 78, name: 'Pro Monthly USD', slug_base: 'pro-monthly', amount_minor: 4999, limits: [counted('ai_messages', 200)] }),
  plan({ id: 79, name: 'Basic Annually USD', slug_base: 'basic-annually', interval: 'annually', interval_label: 'Annually', amount_minor: 9999 }),
  plan({ id: 80 }),
  plan({ id: 81, name: 'Plus Annually USD', slug_base: 'plus-annually', interval: 'annually', interval_label: 'Annually', amount_minor: 119999, limits: [unlimited('ai_messages')] }),
  plan({ id: 82, name: 'Plus Monthly USD', slug_base: 'plus-monthly', amount_minor: 11999, limits: [unlimited('ai_messages')] }),
];

const current = (currentPlan: IPlan, free = false, sub: Partial<ISubscription> = {}): ICurrentSubscriptionData => ({
  plan: currentPlan,
  is_free_tier: free,
  subscription: free
    ? null
    : ({
        id: 1, plan: currentPlan, status: 'active', status_label: 'Active', amount: currentPlan.amount,
        currency: currentPlan.currency, provider: 'paystack', start_date: '2026-09-01T00:00:00Z',
        next_payment_date: '2026-10-01T00:00:00Z', cancelled_at: null, ends_at: null, days_until_renewal: 3,
        is_in_grace_period: false, has_access: true, created_at: '2026-09-01T00:00:00Z',
        ...sub,
      } as ISubscription),
});

test('the live list makes four cards, cheapest first, without the free plan', () => {
  const tiers = buildTiers(LIVE, 'USD');
  assert.deepEqual(tiers.map((tier) => tier.name), ['Basic', 'Pro', 'Plus', 'AI Counsel']);
  assert.deepEqual(tiers.map((tier) => Object.keys(tier.byPeriod).sort()), Array(4).fill(['annually', 'monthly']));
});

test('a currency with no paid plan makes no cards', () => {
  assert.deepEqual(buildTiers(LIVE, 'NGN'), []);
  assert.deepEqual(currenciesOnSale(LIVE), ['USD']);
});

test('the interval comes off the slug wherever it sits', () => {
  assert.equal(tierKey(plan({ slug_base: 'basic-monthly-international' })), 'basic-international');
  assert.equal(tierKey(plan({ slug_base: 'ai-counsel-annually', interval: 'annually' })), 'ai-counsel');
});

test('a card is named by the plan name without its period and currency', () => {
  assert.equal(tierName(plan({ name: 'AI Counsel Monthly USD' })), 'AI Counsel');
  assert.equal(tierName(plan({ name: 'Pro Monthly', currency: 'NGN' })), 'Pro');
  assert.equal(tierName(plan({ name: 'Monthly USD', slug_base: 'gold-monthly' })), 'Gold');
});

test('daily plans are offered to a superadmin only, and monthly is the default', () => {
  const tiers = buildTiers([...LIVE, plan({ id: 90, slug_base: 'basic-daily', interval: 'daily', interval_label: 'Daily', amount_minor: 100 })], 'USD');
  assert.deepEqual(periodsOnSale(tiers, false), ['monthly', 'annually']);
  assert.deepEqual(periodsOnSale(tiers, true), ['daily', 'monthly', 'annually']);
  assert.equal(defaultPeriod(['monthly', 'annually']), 'monthly');
  assert.equal(defaultPeriod(['annually']), 'annually');
  assert.equal(defaultPeriod([]), null);
});

test('a tier not sold at the chosen period shows the period it is sold at', () => {
  const tiers = buildTiers([plan({ id: 1 }), plan({ id: 2, slug_base: 'pro-annually', interval: 'annually', interval_label: 'Annually', amount_minor: 49999 })], 'USD');
  const basic = tiers.find((tier) => tier.key === 'basic');
  assert.ok(basic);
  assert.equal(planFor(basic, 'annually', ['monthly', 'annually'])?.id, 1);
  assert.equal(planFor(basic, 'monthly', ['monthly', 'annually'])?.id, 1);
  assert.equal(planFor(basic, null, []), null);
});

test('the yearly saving is measured from minor units and named once for the switch', () => {
  const tiers = buildTiers(LIVE, 'USD');
  assert.deepEqual(tiers.map(tierSaving), [17, 17, 17, 17]);
  assert.equal(savingHint(tiers), 'save 17%');
  const mixed = buildTiers([...LIVE.filter((p) => p.id !== 79), plan({ id: 79, slug_base: 'basic-annually', interval: 'annually', interval_label: 'Annually', amount_minor: 5994 })], 'USD');
  assert.equal(savingHint(mixed), 'save up to 50%');
  assert.equal(savingHint(buildTiers([plan()], 'USD')), null);
});

test('a price says what is charged and how often; a year also says its month', () => {
  assert.deepEqual(priceView(plan(), 0), { amount: '$9.99', per: 'a month', detail: null });
  const year = plan({ interval: 'annually', interval_label: 'Annually', amount_minor: 9999 });
  assert.deepEqual(priceView(year, 17), { amount: '$99.99', per: 'a year', detail: '$8.33 a month, 17% less than monthly' });
  assert.equal(priceView(plan({ interval_count: 3 }), 0).per, 'every 3 months');
});

test('only counted limits become lines; unlimited ones are left off', () => {
  assert.deepEqual(limitLines(plan()), ['50 AI messages a month']);
  // The server's window is one month for every interval (techlead ecd7bc57).
  assert.deepEqual(limitLines(plan({ interval: 'annually', limits: [counted('ai_messages', 200)] })), ['200 AI messages a month']);
  assert.deepEqual(limitLines(plan({ interval: 'monthly', limits: [counted('ai_messages', 200)] })), ['200 AI messages a month']);
  assert.deepEqual(limitLines(plan({ limits: [unlimited('ai_messages')] })), []);
  assert.deepEqual(
    limitLines(plan({ limits: [counted('bookmarks', 10, 'lifetime'), counted('note_creations', 1, 'month'), counted('ai_messages', 1000)] })),
    ['1,000 AI messages a month', '1 note a month', '10 bookmarks in total'],
  );
});

test('the button decides as v1 did', () => {
  const basic = LIVE.find((p) => p.id === 80);
  const pro = LIVE.find((p) => p.id === 78);
  assert.ok(basic && pro);
  const free = LIVE[0];
  assert.equal(planAction(pro, null), 'subscribe');
  assert.equal(planAction(pro, current(free, true)), 'subscribe');
  assert.equal(planAction(basic, current(basic)), 'current');
  assert.equal(planAction(pro, current(basic)), 'upgrade');
  assert.equal(planAction(basic, current(pro)), 'downgrade');
  assert.equal(planAction(basic, current(plan({ id: 5, currency: 'NGN', amount_minor: 100 }))), 'cross-currency');
  assert.equal(planAction(plan({ id: 6 }), current(basic)), 'subscribe');
});

test('the card holding the account plan is marked; the free tier marks none', () => {
  const tiers = buildTiers(LIVE, 'USD');
  const basic = LIVE.find((p) => p.id === 79);
  assert.ok(basic);
  assert.deepEqual(tiers.map((tier) => isCurrentTier(tier, current(basic))), [true, false, false, false]);
  assert.deepEqual(tiers.map((tier) => isCurrentTier(tier, current(LIVE[0], true))), [false, false, false, false]);
});

test('a cancelled plan that still runs, and a plan in the other currency, are said above the cards', () => {
  const basic = LIVE.find((p) => p.id === 80);
  assert.ok(basic);
  assert.deepEqual(accountNotices(current(basic), 'USD'), []);
  assert.deepEqual(accountNotices(current(basic, true), 'USD'), []);
  assert.deepEqual(accountNotices(current(basic, false, { status: 'cancelled', ends_at: '2026-11-01T00:00:00Z' }), 'USD'), [
    'Your plan is cancelled. It stays active until 1 November 2026, and you can choose a new plan after that.',
  ]);
  assert.deepEqual(accountNotices(current(basic), 'NGN'), [
    'You pay for your plan in US dollars. To pay in Naira, cancel your current plan first. It stays active until its period ends.',
  ]);
  assert.deepEqual(accountNotices(current(basic, false, { status: 'expired', has_access: false }), 'NGN'), []);
});

test('a button names the plan, or the period when the plan is already the account\'s', () => {
  const basic = LIVE.find((p) => p.id === 80);
  const basicYear = LIVE.find((p) => p.id === 79);
  assert.ok(basic && basicYear);
  assert.equal(actionLabel('subscribe', basic, 'Basic', false), 'Choose Basic');
  assert.equal(actionLabel('upgrade', basic, 'Basic', false), 'Upgrade to Basic');
  assert.equal(actionLabel('upgrade', basicYear, 'Basic', true), 'Switch to yearly');
  assert.equal(actionLabel('current', basic, 'Basic', true), 'Your current plan');
  assert.equal(actionLabel('downgrade', basic, 'Basic', false), 'Downgrade');
  assert.equal(actionLabel('cross-currency', basic, 'Basic', false), 'Cancel your plan to switch');
});

// v1's lines, typed out from components/subscriptions/PlanCard.tsx at 7dc7c79,
// so a changed word in the shared table fails here.
const V1_LIBRARY = ['Access to Case, Statute & Notes Library', 'Foreign & Local Cases', 'Multi-Jurisdiction Access'];
const V1_STUDY = ['Study Mode', 'Flashcards', 'Quizzes', 'Connect to a Lawyer'];
const V1_COUNSEL = {
  highlighted: [
    'Unlimited AI Messages', 'Unlimited Library Access', 'Chat with Document (No size limit)', 'Chat with Statute',
    'Legal Drafting', 'Deep Legal Research', 'Deep Contract Review',
  ],
  more: [...V1_LIBRARY, 'Natural Language Search', 'AI Tutor', ...V1_STUDY, 'Twitter Bot for legal updates'],
};
const V1_LINES: Record<string, { highlighted: string[]; more: string[] }> = {
  basic: {
    highlighted: [
      '50 AI Messages', 'Unlimited Library Access', 'Chat with Document (10MB limit)', 'Chat with Statute', 'AI Tutor',
      'Natural Language Search',
    ],
    more: [...V1_LIBRARY, ...V1_STUDY],
  },
  pro: {
    highlighted: [
      '200 AI Messages', 'Unlimited Library Access', '50 Deep Legal Research', 'Chat with Document (25MB limit)',
      'Chat with Statute', 'AI Tutor', 'Natural Language Search',
    ],
    more: [...V1_LIBRARY, ...V1_STUDY],
  },
  plus: V1_COUNSEL,
  'ai-counsel': V1_COUNSEL,
};

test('each of the four cards lists v1\'s lines for its tier, word for word, and not its limits', () => {
  const tiers = buildTiers(LIVE, 'USD');
  assert.deepEqual(tiers.map((tier) => tier.key), ['basic', 'pro', 'plus', 'ai-counsel']);
  for (const tier of tiers) {
    const monthly = tier.byPeriod.monthly;
    assert.ok(monthly);
    assert.deepEqual(cardLines(tier, monthly), V1_LINES[tier.key], tier.key);
  }
  assert.deepEqual(
    tiers.map((tier) => {
      const lines = tierBenefits(tier.key);
      return lines ? [lines.highlighted.length, lines.more.length] : null;
    }),
    [[6, 7], [7, 7], [7, 10], [7, 10]],
  );
});

test('a tier v1 never listed gets no benefits and falls back to its counted limits', () => {
  assert.equal(tierBenefits('gold'), null);
  assert.equal(tierBenefits('basic-international'), null);
  assert.equal(tierBenefits('constructor'), null);
  assert.equal(tierBenefits(''), null);
  const [gold] = buildTiers([plan({ id: 91, name: 'Gold Monthly USD', slug_base: 'gold-monthly', limits: [counted('ai_messages', 500)] })], 'USD');
  assert.ok(gold && gold.byPeriod.monthly);
  assert.deepEqual(cardLines(gold, gold.byPeriod.monthly), { highlighted: ['500 AI messages a month'], more: [] });
  const [bare] = buildTiers([plan({ id: 92, name: 'Gold Monthly USD', slug_base: 'gold-monthly', limits: [unlimited('ai_messages')] })], 'USD');
  assert.ok(bare && bare.byPeriod.monthly);
  assert.deepEqual(cardLines(bare, bare.byPeriod.monthly), { highlighted: [], more: [] });
});

test('switching to Yearly keeps the same benefits on every card', () => {
  const tiers = buildTiers(LIVE, 'USD');
  const periods = periodsOnSale(tiers, false);
  for (const tier of tiers) {
    const monthly = planFor(tier, 'monthly', periods);
    const yearly = planFor(tier, 'annually', periods);
    assert.ok(monthly && yearly && monthly.id !== yearly.id, tier.key);
    assert.equal(yearly.interval, 'annually');
    assert.deepEqual(cardLines(tier, yearly), cardLines(tier, monthly), tier.key);
    assert.deepEqual(cardLines(tier, yearly), V1_LINES[tier.key], tier.key);
  }
});
