import type { IAiMessagesLimit, IGenericLimit } from '@/types/message-pack';

/**
 * What one usage limit shows: counted, or truly unlimited.
 *
 * ── UNLIMITED MEANS THE SERVER COUNTS NOTHING, NOT "NO PLAN LIMIT" ─────────
 * v1 read `plan_limit === null` as unlimited. The server starts the effective
 * limit at `hard_limit` and only lowers it to `plan_limit` when that is smaller
 * (LimitService::getLimitStatus), so a paid plan with `plan_limit` null and
 * `hard_limit` 999 is capped at 999, and v1 told those accounts "Unlimited"
 * (measured 21 September 2026: 63 paying accounts). `remaining` is null only
 * when the effective limit is null, so it is the server's own answer, and the
 * only field read here. `hard_limit` is never read: the server has already
 * resolved it into `remaining`.
 */
export type LimitView =
  | { kind: 'unlimited'; used: number }
  | {
      kind: 'counted';
      used: number;
      total: number;
      left: number;
      /** 0 to 100, for the bar. */
      percent: number;
      /** ISO date the count starts again, or null for a lifetime limit. */
      resetsAt: string | null;
    };

export function limitView(limit: Pick<IGenericLimit, 'used' | 'remaining' | 'resets_at'>): LimitView {
  if (limit.remaining === null) return { kind: 'unlimited', used: limit.used };
  const total = limit.used + limit.remaining;
  const percent = total > 0 ? Math.min(100, Math.round((limit.used / total) * 100)) : 0;
  return {
    kind: 'counted',
    used: limit.used,
    total,
    left: limit.remaining,
    percent,
    resetsAt: limit.resets_at,
  };
}

/**
 * The AI messages block: the plan's own allowance (with its bar), and the
 * pack messages beside it as a separate line.
 *
 * v1's headline was `total_remaining` (plan plus packs) over a bar of the plan
 * alone, so "15 messages" could sit over a full red bar. Here the bar and the
 * number under it measure the same thing, the plan, and the packs are counted
 * on their own line.
 */
export interface AiMessagesView {
  plan: LimitView;
  packs: number;
  /** Everything left to send: plan plus packs, or null when the plan is unlimited. */
  totalLeft: number | null;
}

export function aiMessagesView(ai: IAiMessagesLimit, packBalance: number): AiMessagesView {
  const plan = limitView(ai);
  const packs = Math.max(0, packBalance);
  return {
    plan,
    packs,
    totalLeft: plan.kind === 'unlimited' ? null : plan.left + packs,
  };
}

/** The bar's colour: calm, then a warning at 70%, then alarm at 90%. */
export function barTone(percent: number): 'calm' | 'warn' | 'alarm' {
  if (percent >= 90) return 'alarm';
  if (percent >= 70) return 'warn';
  return 'calm';
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "1 Oct 2026", or "" for a missing or unreadable date. */
export function formatUsageDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const time = Date.parse(iso);
  return Number.isNaN(time) ? '' : DATE.format(time);
}
