import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * =============================================================================
 * THE HOME SECTION — THE BOX IS GONE
 * =============================================================================
 * Replaces `designs/modules/` (Module / ModuleRow / ModuleSkeleton) on the home.
 * The owner rejected the card look outright: "new design of the list i dont like
 * the box."
 *
 * ── WHAT WAS ACTUALLY WRONG, not just the border ────────────────────────────
 * Studying the shipped Work tab first-hand, the box was the symptom of four
 * problems, and only fixing all four gets a clean surface:
 *
 *  1. TWO COLUMNS WITH NO RANK. A composer that says "start here" competed with
 *     four cards of equal visual weight in a rail beside it. The eye had no path.
 *     → One column. The compose cluster leads; everything else is a quiet list
 *       below it, read in order.
 *  2. A BORDER PER GROUP. Six bordered cards on one screen is six rectangles of
 *     chrome to parse before reaching a single word of content, and on a narrow
 *     column each one taxes the usable width twice (border + padding).
 *     → A section is a HEADING and its ROWS. Nothing draws a container. Grouping
 *       comes from space, which costs no pixels and no ink.
 *  3. EVERYTHING SHOUTED EQUALLY. "Your work spaces", "Radar", "Recent
 *     conversations" and "Jump back in" all looked identical, so none of them read
 *     as more important than another.
 *     → Section headings are deliberately QUIET (small, muted, sentence case) and
 *       the ROW TITLE is the loudest thing in the list. You scan content, not
 *       labels.
 *  4. EMPTY BOXES TAUGHT PEOPLE TO STOP LOOKING. An empty Radar card held a full
 *     card's height to say "No radars yet".
 *     → An empty section is one quiet line. It occupies almost nothing, so a
 *       sparse home reads as calm rather than broken.
 *
 * ── THE RULES ───────────────────────────────────────────────────────────────
 * • THREE ROWS. Every home section caps at three (owner). The home is a landing
 *   pad, not a list page; the heading's "All" link is where depth lives.
 * • THE ROW IS THE HIT TARGET. Full-width, 44px floor, rounded on hover only —
 *   so at rest there is no chrome at all, and on hover the target is unambiguous.
 * • HAIRLINES BETWEEN, NOT AROUND. A single `divide-y` inside the list gives the
 *   rhythm a border used to give, at one pixel per gap instead of four per group.
 *
 * Presentational only (no hooks), so any tree can import it; the sections that
 * consume it own all the data.
 * =============================================================================
 */

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Every home section caps here. See rule 1 above. */
export const HOME_SECTION_ROWS = 3;

/**
 * A section — a quiet heading over bare rows. No border, no background, no
 * padding of its own: it is the space around it that groups the rows.
 */
export function HomeSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  /** Optional trailing link to the full list. `prefetch` off inside inert fallbacks. */
  action?: { href: string; label: string; prefetch?: boolean };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn('flex flex-col', className)}>
      <header className="flex items-center justify-between gap-2 px-1 pb-1">
        <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
        {action ? (
          <Link
            href={action.href}
            prefetch={action.prefetch}
            className={cn(
              'v2-interactive -mr-1 inline-flex shrink-0 items-center gap-0.5 rounded-md px-1 py-0.5 text-xs text-muted-foreground/80 transition-colors hover:text-foreground',
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

/** The rows container — hairlines BETWEEN rows, never around the group. */
export function HomeSectionList({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col divide-y divide-border/60">{children}</ul>;
}

/**
 * One row: a leading mark, a title (the loudest thing here), one optional
 * secondary line, and quiet trailing metadata.
 *
 * `title` stays a single line and `secondary` a single line — two lines maximum,
 * which is what keeps a list scannable at a glance. A row that needs more is a
 * page, not a home row.
 */
export function HomeSectionRow({
  href,
  icon: Icon,
  title,
  titleAside,
  secondary,
  meta,
  unread = false,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  /** A quiet qualifier beside the title — a space name, a content type. */
  titleAside?: string;
  secondary?: React.ReactNode;
  meta?: string | null;
  unread?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'v2-interactive group flex min-h-11 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/60',
          FOCUS_RING,
        )}
      >
        <Icon
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-foreground"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2">
            <span
              className={cn(
                'min-w-0 truncate text-sm text-foreground',
                unread ? 'font-semibold' : 'font-medium',
              )}
            >
              {title}
            </span>
            {titleAside ? (
              <span className="shrink-0 truncate text-xs text-muted-foreground/70">
                {titleAside}
              </span>
            ) : null}
          </span>
          {secondary ? (
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {secondary}
            </span>
          ) : null}
        </span>
        {meta ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground/60">
            {meta}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/**
 * The loading shape — rows at the real geometry, no card. `rows` defaults to the
 * section cap because that IS the real count here: unlike the old modules, a home
 * section never renders more than three, so reserving three cannot over-reserve.
 */
export function HomeSectionSkeleton({
  rows = HOME_SECTION_ROWS,
  still = false,
}: {
  rows?: number;
  /**
   * Reserve the shape without the pulse. A pulse promises a request is in flight;
   * the route fallback has none behind it (it waits on an RSC payload while the
   * queries below it are often already warm), and pulsing over data we hold is
   * what the standing corollary forbids.
   */
  still?: boolean;
}) {
  const bar = still ? 'animate-none' : undefined;
  return (
    <ul className="flex flex-col divide-y divide-border/60" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="flex min-h-11 items-center gap-3 px-2 py-2.5">
          <Skeleton className={cn('size-4 shrink-0 rounded', bar)} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className={cn('h-3.5 w-1/2 rounded', bar)} />
            <Skeleton className={cn('h-3 w-3/4 rounded', bar)} />
          </div>
          <Skeleton className={cn('h-3 w-8 shrink-0 rounded', bar)} />
        </li>
      ))}
    </ul>
  );
}

/** Empty — ONE quiet line, not a card's worth of height. See rule 4 above. */
export function HomeSectionEmpty({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <p className="flex items-center gap-2 px-2 py-2.5 text-sm text-muted-foreground">
      {title}
      {action ? (
        <Link
          href={action.href}
          className={cn(
            'v2-interactive rounded-md text-primary transition-colors hover:underline',
            FOCUS_RING,
          )}
        >
          {action.label}
        </Link>
      ) : null}
    </p>
  );
}

/** Error — same one-line footprint, with a real retry. Distinct from empty. */
export function HomeSectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <p className="flex items-center gap-2 px-2 py-2.5 text-sm text-muted-foreground">
      {message}
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'v2-interactive rounded-md text-foreground underline-offset-4 transition-colors hover:underline',
          FOCUS_RING,
        )}
      >
        Try again
      </button>
    </p>
  );
}
