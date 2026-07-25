import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CONTENT_FADE, FOCUS_RING } from './meta';

/**
 * =============================================================================
 * THE SHARED HOME-MODULE DESIGN SYSTEM  (owner #38)
 * =============================================================================
 * ONE card / header / row / badge / skeleton / empty / error language consumed by
 * BOTH the Work and Study home tabs (and every future home module). It replaces
 * the two drifted primitive sets — `work/primitives.tsx` (rounded-xl, header with
 * no icon, single-line `<Skeleton>` rows, a text-only retry, `bg-secondary`
 * tiles) and `study/parts.tsx` (rounded-2xl, header with an icon, two-line
 * opacity-fade skeletons, a bordered retry, `bg-muted` tiles) — that a reviewer
 * flagged and the owner then saw live. There is now exactly one of each.
 *
 * The owner rejected the shipped modules as "flat dark boxes" with "muddled
 * hierarchy" and explicitly asked for online research. The principles below were
 * pulled from how the best 2025-26 products build dashboard modules and side
 * rails, and each shaped a concrete decision here:
 *
 *  • HAIRLINE CHROME, NOT SHADOW; RADIUS BY RANK (Linear). Linear builds card
 *    separation from a 1px hairline border on a raised surface, never ambient
 *    shadow, and reserves the larger radius for bigger panels. → Modules are a
 *    hairline `border-border` on `bg-card` at a single `rounded-2xl`, no shadow
 *    (the composer keeps the only shadow on the page, so it stays the hero and
 *    the modules recede). Rows round to `rounded-lg` inside — the within-card
 *    step down that Linear uses.
 *
 *  • SECTION HEADER = LEGIBLE + SENTENCE CASE, NOT A TINY UPPERCASE LABEL
 *    (dashboard-patterns write-up + Linear). The shipped `text-xs uppercase
 *    tracking-wider text-muted-foreground` label is exactly the templated default
 *    the owner reacted to. → Headers are `text-sm font-semibold text-foreground`
 *    in sentence case ("Jump back in", "Your work spaces") with the icon demoted
 *    to a quiet muted leading mark. The header now reads as a title, not a
 *    system label.
 *
 *  • LOW WEIGHT BAND, CLEAR PRIMARY/SECONDARY CONTRAST (Linear runs weights in a
 *    400-510 band, not bold, and lets contrast carry hierarchy). → Row primary is
 *    `font-medium text-foreground`, bumping to `font-semibold` only to mark
 *    unread; secondary is `text-xs text-muted-foreground`; times/counts are
 *    tabular. Gold is confined to the unread dot and the count pill.
 *
 *  • ROW ANATOMY: LEADING VISUAL → TWO-LINE TEXT → TRAILING METADATA
 *    (dashboard list-row guidance: left-align text, right-align numbers, center
 *    status; comfortable rows scan at ~44-52px). → `ModuleRow` (see rows.tsx) is
 *    a 36px identity tile, a primary line with optional inline context, one
 *    secondary line, and a right-aligned trailing cluster. Two lines maximum —
 *    the fix for the "cramped previews" the owner called out.
 *
 *  • HOVER = SURFACE TINT LIFT (Linear). → Rows tint `hover:bg-secondary/60`,
 *    press to `active:bg-secondary`; the leading tile warms to the foreground.
 *    Calm, never a jump.
 *
 *  • THREE EXPLICIT, COMPONENT-SCOPED STATES (dashboard-patterns: a component
 *    owns its own loading / empty / error, never a full-page block; empty is an
 *    illustration + one sentence + a CTA; error states say what failed and offer
 *    a retry). → `ModuleSkeleton` mirrors the real row (tile + two text bars +
 *    trailing), `ModuleEmpty` is an icon + one line + optional CTA, `ModuleError`
 *    is a distinct message + retry — empty never reads as failure and failure is
 *    always recoverable in place.
 *
 * Presentational only (no hooks), so it stays importable by any tree; the
 * modules that consume it own all the data. Cross-boundary links use `next/link`
 * to the canonical clean paths, which fall through the proxy to the v1 screens —
 * the same convention the sidebar recents use.
 * =============================================================================
 */

/**
 * A module card — a hairline panel with a legible sentence-case header (optional
 * leading icon + optional trailing action link) over a body slot. Every home
 * module is one of these, so the Work rail and the Study rail read as one system.
 */
export function Module({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  /** Quiet leading mark for the header. */
  icon?: LucideIcon;
  /**
   * Optional trailing header link — e.g. "All" → the full v1 route.
   *
   * `prefetch: false` exists for INERT renders (a route-level loading fallback
   * draws real module frames to reserve their geometry). `next/link` defaults
   * `prefetch` to enabled and registers every link with a shared
   * IntersectionObserver via a callback ref — and `inert` suppresses focus,
   * clicks and pointer events but does NOT stop refs, observers or network. So
   * without this, a fallback about to be deleted fires genuine RSC prefetches
   * for routes the user never asked for (and, because prefetching is disabled in
   * dev, only ever in the deployed build).
   */
  action?: { href: string; label: string; prefetch?: boolean };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col rounded-2xl border border-border bg-card',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3.5">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          {Icon ? (
            <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          ) : null}
          <span className="truncate">{title}</span>
        </h2>
        {action ? (
          <Link
            href={action.href}
            prefetch={action.prefetch}
            className={cn(
              'v2-interactive -mr-1.5 inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
              FOCUS_RING,
            )}
          >
            {action.label}
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/**
 * Skeleton rows sized to the real `ModuleRow` — a leading tile, one or two text
 * bars, and a trailing stub. `lines={1}` matches a one-line row (a conversation
 * strip).
 *
 * ── THE RESERVATION POLICY LIVES HERE, AND NOWHERE ELSE ─────────────────────
 * `rows` defaults to THREE and no home module overrides it. That default IS the
 * policy, so there is exactly one number to reason about and nothing for a
 * module to drift away from.
 *
 * Three is a MEDIAN reservation, deliberately not the row cap. A round of
 * cap-sized skeletons (5/8 rows) was tried and reverted, because it optimised
 * for a shift that cannot happen at the expense of the one that does:
 *
 *  • Every module clamps its data with `.slice(0, MAX_ROWS)`, so a resolved list
 *    can never be LONGER than the cap. Reserving at the cap therefore buys
 *    protection against nothing.
 *  • The real shift is the skeleton COLLAPSING onto a short or empty list, and
 *    reserving at the cap makes that shift far worse — "Recently viewed" alone
 *    went from a ~72px settle to a ~332px one, on the very module whose own
 *    docblock says a sparse page is NORMAL. Across a cold mobile Study load that
 *    compounded into several hundred pixels of upward collapse.
 *  • And it lands in the LONG window: the module skeleton waits on a real API
 *    round trip, unlike the route fallback, which waits only on an RSC payload.
 *
 * So: reserve near the middle of the distribution, absorb a small settle in
 * either direction, and never a large one. A module that is reliably FULL may
 * pass a higher `rows` — but it has to earn it with evidence, not with its cap.
 *
 * MOTION: the shared `Skeleton` primitive hard-codes `animate-pulse` with no
 * reduced-motion guard of its own, but `v2/shell/shell.css` now stills EVERY v2
 * skeleton under `prefers-reduced-motion`, scoped to `html.v2-document-lock` (the
 * class the v2 layout adds while mounted, so v1 is untouched). The per-bar
 * `motion-reduce:animate-none` below is therefore REDUNDANT — it is kept only
 * because it is harmless and self-documenting, and it can be deleted freely. New
 * v2 skeletons need no local guard. Fixing the primitive itself remains the
 * long-term goal for v1's sake; it is v1-shared, so it needs a byte-identity call.
 */
const SKELETON_BAR = 'motion-reduce:animate-none';

export function ModuleSkeleton({
  rows = 3,
  lines = 2,
  still = false,
}: {
  rows?: number;
  lines?: 1 | 2;
  /**
   * Reserve the SHAPE without the pulse. A pulse is a promise that a request is
   * in flight; the route fallback (`HomeFallback`) has no request behind it — it
   * is waiting on an RSC payload, while the module queries below it are often
   * already WARM in the cache (`GC_TIMES.list`). Pulsing there would animate over
   * data we already hold, which the standing corollary forbids. The real module
   * still pulses, because it genuinely is waiting on the API.
   */
  still?: boolean;
}) {
  const bar = cn(SKELETON_BAR, still && 'animate-none');
  return (
    <ul className="flex flex-col px-2 pb-2" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="flex min-h-11 items-center gap-3 px-2 py-2">
          <Skeleton className={cn('size-9 shrink-0 rounded-lg', bar)} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className={cn('h-3.5 w-1/2 rounded', bar)} />
            {lines === 2 ? <Skeleton className={cn('h-3 w-3/4 rounded', bar)} /> : null}
          </div>
          <Skeleton className={cn('h-3 w-8 shrink-0 rounded', bar)} />
        </li>
      ))}
    </ul>
  );
}

/**
 * A designed empty state — a quiet icon, one sentence, and an optional soft CTA
 * (create / browse). Understated so an empty module never shouts, but never a
 * bare line of text either.
 */
export function ModuleEmpty({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 px-4 pb-6 pt-1 text-center',
        CONTENT_FADE,
      )}
    >
      <span
        aria-hidden
        className="flex size-9 items-center justify-center rounded-full bg-secondary text-muted-foreground"
      >
        <Icon className="size-[18px]" />
      </span>
      <p className="text-sm text-muted-foreground">{title}</p>
      {action ? (
        <Link
          href={action.href}
          className={cn(
            'v2-interactive rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-secondary',
            FOCUS_RING,
          )}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The module error state — visually distinct from empty (a bordered retry, not
 * the gold CTA), so a failure never reads as "nothing here". Offers a real retry
 * (the query's `refetch`) so it is recoverable in place.
 */
export function ModuleError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 px-4 pb-6 pt-1 text-center',
        CONTENT_FADE,
      )}
    >
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'v2-interactive rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-secondary',
          FOCUS_RING,
        )}
      >
        Try again
      </button>
    </div>
  );
}
