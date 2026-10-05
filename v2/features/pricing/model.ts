import { oneOffPeriodNoun } from '@/lib/utils/one-period-subscription';
import {
  calculateAnnualSavingsPct,
  formatPlanAmount,
  formatPlanMonthlyFromAnnual,
} from '@/lib/utils/payment-format';
import { TIER_FEATURES } from '@/lib/constants/plan-features';
import type { TCurrency } from '@/types/payment';
import type { ICurrentSubscriptionData, IPlan, IPlanLimit, TLimitType } from '@/types/subscription';
import { formatBillingDate } from '@/v2/features/settings/billing/model';
import { currencyName } from '@/v2/features/settings/message-packs/currency-offer';

/**
 * Pricing — the pure part: which plans make one card, the order the cards
 * sit in, what each card says, and what its button may do. No React, so it is
 * tested with Node's runner.
 *
 * ── THE BENEFITS ARE v1's, WORD FOR WORD ───────────────────────────────────
 * The owner asked for the benefits "as is" (5 October 2026), so a card lists
 * v1's lines for its tier from the one table both versions read
 * (`lib/constants/plan-features.ts`, moved there from v1's PlanCard): the
 * highlighted lines always, the rest behind "More features". They are the
 * product's copy, not the plan rows: the server's `features` array is empty
 * on every paid plan, and a line such as "Unlimited AI Messages" is not
 * checked against the limit the row counts (the 21 September 2026 study found
 * plans enforcing 50 under it).
 *
 * A tier v1 has no lines for falls back to the limits its plan row COUNTS
 * ("200 AI messages a month"). A tier with v1's lines does not also print its
 * limits, so a card never says "Unlimited AI Messages" and a number together.
 *
 * A limit the row marks `is_unlimited` is left off. The server resolves a
 * plan's limit against a hard ceiling (LimitService::getLimitStatus), and
 * "no plan limit" has meant "capped at 999" for notes on every paid plan; the
 * plan list does not carry the ceiling, so "unlimited" cannot be printed as a
 * fact from the row. The Usage screen tells the truth after the purchase, from
 * `remaining`, which is resolved.
 *
 * ── THE ORDER IS THE PRICE ─────────────────────────────────────────────────
 * v1 ordered tiers by a list of four names and sent any name it did not know
 * to the end. The cheaper plan first is a fact every plan carries, so the cards
 * sort by what a month costs and a new tier lands where its price puts it.
 */

/** Sign-in and registration both come back here (v1's auth pages honour `?redirect=`). */
export const SIGN_IN_HREF = '/login?redirect=%2Fpricing';
export const REGISTER_HREF = '/register?redirect=%2Fpricing';

/** The billing periods the page offers, in the order the switch lists them. */
export const PERIODS = ['daily', 'monthly', 'annually'] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABEL: Record<Period, string> = {
  daily: 'Daily',
  monthly: 'Monthly',
  annually: 'Yearly',
};

function isPeriod(interval: string): interval is Period {
  return (PERIODS as readonly string[]).includes(interval);
}

/** One card: a plan sold at one or more periods. */
export interface Tier {
  key: string;
  name: string;
  description: string | null;
  featured: boolean;
  byPeriod: Partial<Record<Period, IPlan>>;
}

/**
 * The key that groups one plan's periods. `slug_base` is the slug without its
 * currency marker, so "pro-monthly" and "pro-annually" differ only by the
 * interval, which is removed wherever it sits: international slugs read
 * "basic-monthly-international", so the interval is not always last. The plan
 * names its own interval, so nothing here guesses which segment it is.
 */
export function tierKey(plan: IPlan): string {
  const base = plan.slug_base || plan.slug;
  const interval = plan.interval.toLowerCase();
  const parts = base.split('-').filter((part) => part.length > 0);
  const kept = parts.filter((part) => part.toLowerCase() !== interval);
  // An unexpected slug that was nothing but its interval keeps v1's old
  // reading rather than an empty key that would fold every plan into one card.
  return kept.length > 0 ? kept.join('-') : parts.slice(0, -1).join('-');
}

/**
 * The card's title, from the plan's own name with its period and currency
 * taken off: "AI Counsel Monthly USD" reads "AI Counsel". The key is the
 * fallback for a name that was nothing else.
 */
export function tierName(plan: IPlan): string {
  const noise = new Set([plan.interval, plan.interval_label, plan.currency].map((word) => word.toLowerCase()));
  const words = plan.name.split(/\s+/).filter((word) => word.length > 0 && !noise.has(word.toLowerCase()));
  if (words.length > 0) return words.join(' ');
  return tierKey(plan)
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** What one month of a plan costs, in minor units; used only to order cards. */
function monthlyMinor(plan: IPlan): number {
  const count = Math.max(1, plan.interval_count);
  if (plan.interval === 'annually') return plan.amount_minor / (12 * count);
  if (plan.interval === 'daily') return (plan.amount_minor * 30) / count;
  return plan.amount_minor / count;
}

function cheapestMonthly(tier: Tier): number {
  return Math.min(...Object.values(tier.byPeriod).map(monthlyMinor));
}

/**
 * The paid plans sold in `currency`, one card per tier, cheapest first. The
 * free plan is not a card: v1 never drew it either, and it is what an account
 * has without buying anything.
 */
export function buildTiers(plans: readonly IPlan[], currency: TCurrency): Tier[] {
  const tiers = new Map<string, Tier>();
  for (const plan of plans) {
    if (plan.is_free || plan.currency !== currency || !isPeriod(plan.interval)) continue;
    const key = tierKey(plan);
    const tier = tiers.get(key) ?? {
      key,
      name: tierName(plan),
      description: plan.description?.trim() || null,
      featured: false,
      byPeriod: {},
    };
    tier.byPeriod[plan.interval] = plan;
    tier.featured = tier.featured || plan.is_featured;
    // The monthly plan names the tier when there is one: its name and words
    // are the ones a reader compares against.
    if (plan.interval === 'monthly') {
      tier.name = tierName(plan);
      tier.description = plan.description?.trim() || tier.description;
    }
    tiers.set(key, tier);
  }
  return [...tiers.values()].sort(
    (a, b) => cheapestMonthly(a) - cheapestMonthly(b) || a.name.localeCompare(b.name),
  );
}

/** The currencies there is a paid plan in, for the currency switch. */
export function currenciesOnSale(plans: readonly IPlan[]): TCurrency[] {
  return [...new Set(plans.filter((plan) => !plan.is_free).map((plan) => plan.currency))];
}

/**
 * The periods any card is sold at, in switch order. Daily plans exist for
 * testing payments and only a superadmin is offered them, as in v1.
 */
export function periodsOnSale(tiers: readonly Tier[], includeDaily: boolean): Period[] {
  return PERIODS.filter(
    (period) => (includeDaily || period !== 'daily') && tiers.some((tier) => tier.byPeriod[period]),
  );
}

/** Monthly when it is sold, else the first period that is. */
export function defaultPeriod(periods: readonly Period[]): Period | null {
  return periods.includes('monthly') ? 'monthly' : (periods[0] ?? null);
}

/**
 * The plan a card shows for the chosen period. A tier not sold at that period
 * shows the period it is sold at, and its price line names that period, so
 * the card is never empty and never mislabelled.
 */
export function planFor(tier: Tier, period: Period | null, periods: readonly Period[]): IPlan | null {
  if (period && tier.byPeriod[period]) return tier.byPeriod[period];
  for (const option of periods) {
    const plan = tier.byPeriod[option];
    if (plan) return plan;
  }
  return null;
}

/** The whole-number percentage a year saves against twelve months, or 0. */
export function tierSaving(tier: Tier): number {
  const monthly = tier.byPeriod.monthly;
  const annual = tier.byPeriod.annually;
  if (!monthly || !annual || monthly.currency !== annual.currency) return 0;
  return Math.max(0, calculateAnnualSavingsPct(monthly.amount_minor, annual.amount_minor));
}

/** The hint beside "Yearly": "save 17%", "save up to 17%", or null. */
export function savingHint(tiers: readonly Tier[]): string | null {
  const savings = tiers.map(tierSaving).filter((saving) => saving > 0);
  if (savings.length === 0) return null;
  const best = Math.max(...savings);
  return savings.every((saving) => saving === best) ? `save ${best}%` : `save up to ${best}%`;
}

/** "a month", "a year", "every 3 months". */
export function perPeriod(plan: Pick<IPlan, 'interval' | 'interval_count'>): string {
  const noun = oneOffPeriodNoun(plan.interval);
  return plan.interval_count > 1 ? `every ${plan.interval_count} ${noun}s` : `a ${noun}`;
}

export interface PriceView {
  /** "$9.99". */
  amount: string;
  /** "a month". */
  per: string;
  /** Under the price: a year's plan as a month, with its saving. */
  detail: string | null;
}

export function priceView(plan: IPlan, saving: number): PriceView {
  const amount = formatPlanAmount(plan);
  const per = perPeriod(plan);
  if (plan.interval === 'annually' && plan.interval_count === 1) {
    const monthly = `${formatPlanMonthlyFromAnnual(plan)} a month`;
    return { amount, per, detail: saving > 0 ? `${monthly}, ${saving}% less than monthly` : monthly };
  }
  return { amount, per, detail: null };
}

const LIMIT_NOUN: Record<TLimitType, readonly [string, string]> = {
  ai_messages: ['AI message', 'AI messages'],
  note_creations: ['note', 'notes'],
  bookmarks: ['bookmark', 'bookmarks'],
};

const LIMIT_ORDER: readonly TLimitType[] = ['ai_messages', 'note_creations', 'bookmarks'];

/**
 * How often a counted limit resets. `billing_interval` reads like "per plan
 * period", but the server's window is ONE MONTH from the subscription start
 * whatever the plan's interval (`LimitService::getBillingPeriodDates`,
 * backend origin/main lines 305-344; techlead ecd7bc57, 5 October 2026). So a
 * yearly plan's 200 AI messages are 200 a month, and the card says so.
 */
function limitWhen(limit: IPlanLimit): string {
  return limit.period === 'lifetime' ? 'in total' : 'a month';
}

/**
 * The limits the plan row counts, as lines: "200 AI messages a month", for a
 * yearly plan too (see `limitWhen`). Unlimited rows are left off (see the
 * docblock).
 */
export function limitLines(plan: IPlan): string[] {
  return LIMIT_ORDER.flatMap((type) => {
    const limit = plan.limits.find((row) => row.type === type);
    if (!limit || limit.is_unlimited || limit.value < 0) return [];
    const [one, many] = LIMIT_NOUN[type];
    const count = limit.value.toLocaleString('en-GB');
    return [`${count} ${limit.value === 1 ? one : many} ${limitWhen(limit)}`];
  });
}

/** The lines a card lists: `highlighted` always shows, `more` behind a toggle. */
export interface CardLines {
  highlighted: readonly string[];
  more: readonly string[];
}

/**
 * v1's benefit lines for a tier, matched on the tier key as v1 matched it
 * ("basic", "pro", "plus", "ai-counsel"), or null for a tier v1 never listed.
 * Own keys only, so a key such as "constructor" is not read off the prototype.
 */
export function tierBenefits(key: string): CardLines | null {
  return Object.hasOwn(TIER_FEATURES, key) ? TIER_FEATURES[key] : null;
}

/**
 * What one card lists for the plan it shows. The benefits belong to the tier,
 * so Monthly and Yearly list the same lines; only a tier without v1's lines
 * reads its limits off the plan shown (see the docblock).
 */
export function cardLines(tier: Pick<Tier, 'key'>, plan: IPlan): CardLines {
  return tierBenefits(tier.key) ?? { highlighted: limitLines(plan), more: [] };
}

/**
 * What a card's button may do, decided as v1 decided it (v1's
 * `getPlanAction`), because the backend's rules sit behind it: an upgrade is
 * a higher price in the same currency, a lower price is reached only by
 * cancelling first, and a plan in another currency is refused with a 422
 * until the current one is cancelled. Amounts compare in minor units, never
 * the decimal string.
 *
 * Only paid plans reach this (`buildTiers` drops the free plan), so v1's two
 * free-plan answers have no card to land on and are not carried.
 */
export type PlanAction = 'current' | 'subscribe' | 'upgrade' | 'downgrade' | 'cross-currency';

export function planAction(plan: IPlan, current: ICurrentSubscriptionData | null): PlanAction {
  if (!current) return 'subscribe';
  if (current.plan.id === plan.id) return 'current';
  if (current.is_free_tier) return 'subscribe';
  if (current.plan.currency !== plan.currency) return 'cross-currency';
  if (plan.amount_minor > current.plan.amount_minor) return 'upgrade';
  if (plan.amount_minor < current.plan.amount_minor) return 'downgrade';
  return 'subscribe';
}

/** The plan the account is on, among the cards, so its card can say so. */
export function isCurrentTier(tier: Tier, current: ICurrentSubscriptionData | null): boolean {
  if (!current || current.is_free_tier) return false;
  return Object.values(tier.byPeriod).some((plan) => plan.id === current.plan.id);
}

/**
 * The sentences above the cards about the plan the account already has, as
 * v1 showed them: a cancelled plan that is still running, and a plan paid in
 * a currency other than the one the cards are priced in.
 */
export function accountNotices(current: ICurrentSubscriptionData | null, currency: TCurrency): string[] {
  const subscription = current?.subscription;
  if (!current || current.is_free_tier || !subscription?.has_access) return [];
  const notices: string[] = [];
  if (subscription.status === 'cancelled') {
    const endsOn = formatBillingDate(subscription.ends_at);
    notices.push(
      endsOn
        ? `Your plan is cancelled. It stays active until ${endsOn}, and you can choose a new plan after that.`
        : 'Your plan is cancelled. You can choose a new plan when its current period ends.',
    );
  }
  if (subscription.currency !== currency) {
    notices.push(
      `You pay for your plan in ${currencyName(subscription.currency)}. To pay in ${currencyName(currency)}, cancel your current plan first. It stays active until its period ends.`,
    );
  }
  return notices;
}

/**
 * The words on a card's button. On the account's own tier a dearer period is
 * still an upgrade to the server, but to the reader it is the same plan paid
 * another way, so it says that.
 */
export function actionLabel(action: PlanAction, plan: IPlan, tierTitle: string, isCurrent: boolean): string {
  switch (action) {
    case 'current':
      return 'Your current plan';
    case 'downgrade':
      return 'Downgrade';
    case 'cross-currency':
      return 'Cancel your plan to switch';
    case 'upgrade':
    case 'subscribe':
      if (isCurrent && isPeriod(plan.interval)) return `Switch to ${PERIOD_LABEL[plan.interval].toLowerCase()}`;
      return action === 'upgrade' ? `Upgrade to ${tierTitle}` : `Choose ${tierTitle}`;
  }
}
