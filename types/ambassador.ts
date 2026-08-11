import type { PaginationMeta, PaginationLinks } from './case';

export type AmbassadorStatus = 'pending' | 'approved' | 'rejected';

export interface AmbassadorUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface AmbassadorApplication {
  id: number;
  uuid: string;
  user: AmbassadorUser | null;
  name: string;
  email: string;
  phone: string;
  country: string | null;
  university: string | null;
  law_school: string | null;
  faculty: string | null;
  level: string | null;
  motivation: string;
  growth_plan: string;
  leadership_experience: string | null;
  social_handle: string | null;
  heard_from: string | null;
  status: AmbassadorStatus;
  status_label: string;
  reviewed_by: AmbassadorUser | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AmbassadorListResponse {
  success: boolean;
  message: string;
  data: AmbassadorApplication[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

export interface AmbassadorListParams {
  status?: AmbassadorStatus;
  sort?: 'created_at' | 'status' | 'updated_at' | 'reviewed_at';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

/* ── Referral codes and numbers (2026-08-11) ────────────────────────────────
   The code half was typed first, and the performance half deliberately waited:
   an audit found `referred_count` counted almost everybody twice — once as a
   guest, again at registration — and `revenue` was summing naira and dollars
   into one meaningless figure. Both were corrected and are live, so the shapes
   below are the settled ones.
   ───────────────────────────────────────────────────────────────────────── */

/**
 * One code an ambassador has held.
 *
 * A RETIRED CODE STILL WORKS, and that is the whole point of keeping the list.
 * Ambassadors print their code on a face card and hand it out; changing the
 * code must not break a card already in somebody's pocket. The screen shows the
 * retired ones so they can see that has not happened.
 */
export interface AmbassadorCode {
  code: string;
  is_current: boolean;
  retired_at: string | null;
  created_at?: string;
}

/** `current` is `null` before they have ever claimed one — that is the state
 *  that renders the claim form, NOT an error. */
export interface AmbassadorCodeState {
  current: AmbassadorCode | null;
  history: AmbassadorCode[];
}

/** One code's own tally. Present for every code they have ever held, current
 *  and retired, and a code that brought nobody appears as zero rather than
 *  being left out — "brought nobody" and "not listed" are different answers. */
export interface AmbassadorCodeTally {
  code: string;
  is_current: boolean;
  referred_count: number;
}

/**
 * What an ambassador is shown about their own work.
 *
 * EVERY ONE OF THESE THREE COUNTS MEANS SOMETHING DIFFERENT, and the labels on
 * screen have to keep them apart:
 *  - `referred_count` — people who CREATED AN ACCOUNT. Not link clicks and not
 *    visitors. A guest who never registered is not counted, and somebody who
 *    was a guest before registering is not counted twice. Say "signed up",
 *    never "opened your link".
 *  - `confirmed_count` — how many of those confirmed their email, which is the
 *    moment the free pack is granted. This is the promise the ambassador
 *    personally made when they handed the code out, so it is the one that tells
 *    them whether it was kept.
 *  - `paid_count` — ever paid Lawexa money, subscribed or bought a pack, even
 *    if later cancelled. Excludes refunds, unconverted trials, the free plan
 *    and gifts — INCLUDING the welcome pack every referred person gets, so it
 *    can never be inflated by our own giveaway.
 *
 * `last_referral_at` is null when they have referred nobody. There is no
 * earnings figure here and there is not meant to be: nobody has decided
 * ambassadors are paid anything.
 */
export interface AmbassadorPerformance {
  code: string | null;
  retired_codes: string[];
  by_code: AmbassadorCodeTally[];
  referred_count: number;
  confirmed_count: number;
  paid_count: number;
  last_referral_at: string | null;
}

/**
 * Money, per currency, as decimal STRINGS.
 *
 * ── WHY IT IS A MAP AND NOT A NUMBER ───────────────────────────────────────
 * Lawexa is paid in naira and in dollars. Until 2026-08-11 the server added
 * them together, so "139,200 naira plus 17 dollars" arrived as 255,221 of
 * nothing — a figure that is not money in any currency and cannot honestly be
 * labelled. Our audit is what found it. They are now separate and NOTHING IS
 * CONVERTED, because converting needs a rate and any rate here would be
 * invented.
 *
 * THE VALUES STAY STRINGS. They are summed exactly on the server; parsing them
 * into a float throws that exactness away for no gain, since the client only
 * ever formats them. No arithmetic, client-side totals included — `totals`
 * exists so nobody has to do any.
 *
 * NO MONEY AT ALL IS `{}`, not `"0.00"` — there is no currency to name.
 */
export type MoneyByCurrency = Record<string, string>;

/** Their heaviest single day, and when it was. `signups` counts PEOPLE — it was
 *  once a bare number that could equally have been read as a weekday, which is
 *  why it now carries its date. Null/0 for somebody who has referred nobody. */
export interface BusiestDay {
  date: string | null;
  signups: number;
}

/**
 * One row of the admin financials table.
 *
 * `revenue` IS WHAT THE REFERRED PEOPLE SPENT. It is not commission and not
 * earnings — nobody has decided ambassadors are paid anything, so no column
 * built on this may be called "earnings" or "owed".
 *
 * `gifted_messages` is a COUNT OF MESSAGES, not money: granted packs are
 * zero-amount rows and any naira figure would be invented.
 *
 * `unusual_activity` flags more than 20 signups in one day. It is a prompt to
 * look, never an accusation — an ambassador demoing to a lecture hall trips it
 * exactly as a farmer would — so it may not be drawn as a warning or a block.
 */
export interface AmbassadorFinancialRow {
  user_uuid: string;
  /** Opens the application behind the row. Null only if it has been removed. */
  application_uuid: string | null;
  name: string;
  email: string;
  code: string | null;
  referred_count: number;
  paid_count: number;
  revenue: MoneyByCurrency;
  gifted_messages: number;
  last_referral_at: string | null;
  busiest_day: BusiestDay;
  unusual_activity: boolean;
}

export interface AmbassadorFinancialTotals {
  ambassadors: number;
  referred_count: number;
  paid_count: number;
  revenue: MoneyByCurrency;
  gifted_messages: number;
}

export interface AmbassadorFinancials {
  ambassadors: AmbassadorFinancialRow[];
  totals: AmbassadorFinancialTotals;
}

/** One day on an ambassador's record — the evidence behind the flag. */
export interface AmbassadorDailySignup {
  date: string;
  signups: number;
}

export interface ApproveAmbassadorData {
  review_notes?: string;
}

export interface RejectAmbassadorData {
  review_notes: string;
}
