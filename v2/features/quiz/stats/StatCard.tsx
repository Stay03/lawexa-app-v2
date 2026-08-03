import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * StatCard — one headline metric.
 *
 * ── "—" IS A FIRST-CLASS VALUE HERE ─────────────────────────────────────────
 * The caller passes an em dash when a metric has no honest value yet (see
 * `readStats`), and the card renders it in MUTED ink rather than the value ink.
 * That difference is the whole point: "—" is not a number, and dressing it like
 * one invites the reader to compare it with the tiles beside it.
 *
 * ── PROPORTIONAL FIGURES, NOT TABULAR ───────────────────────────────────────
 * `tabular-nums` gives every digit the width of a zero, which makes a large
 * standalone value look loose ("12%" reads with a gap). Tabular figures are for
 * columns that must align vertically — the breakdown rows, the axis ticks —
 * not for a headline number.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  empty = false,
}: {
  icon: LucideIcon;
  /** Sentence case, no trailing colon. */
  label: string;
  value: string;
  /** One quiet line of provenance — what the number is made of. */
  sub?: string;
  /** True when `value` is the em dash, i.e. there is no data yet. */
  empty?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon aria-hidden className="size-3.5" />
        {label}
      </p>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold',
          empty ? 'text-muted-foreground/60' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  );
}
