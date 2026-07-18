import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Shared building blocks for the Work home modules (Your work spaces, Jump back
 * in, Radar, Recent conversations). Factored here so the four modules can never
 * drift on module-card chrome, row shape, skeleton/error/empty states, the §17
 * badge language, or the relative-time format — the same reason HomeComposer /
 * HomeGreeting / HomePrompts are shared across the home tabs.
 *
 * Presentational only (no hooks); rendered inside the `'use client'` WorkHome
 * tree. Cross-boundary rows use `next/link` to the canonical clean paths, which
 * fall through the proxy to the v1 screens — the same convention V2Sidebar uses
 * for its recents + nav.
 */

/** Unified focus ring, matched to the rest of the v2 home surface. */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** The shared row shell — one interactive list row across every module. 44px
 *  minimum touch target (mobile), truncation-safe, quiet hover tint. */
export const ROW_CLASS = cn(
  'group v2-interactive flex min-h-11 items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-secondary/60 active:bg-secondary',
  FOCUS_RING,
);

/**
 * Compact relative time for a module row. Pure — `now` is threaded in from a
 * lazy `useState` initializer at the call site so no `Date.now()`/`new Date()`
 * runs in render (React Compiler), and the ISO string is parsed with the
 * deterministic `Date.parse`. (The proven helper carried over from the retired
 * HomeDesignB.)
 */
export function formatRelativeTime(iso: string | null, now: number): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(days / 365)}y`;
}

/**
 * A module card — the header (uppercase label + optional "All"/action link) and
 * a body slot. One consistent panel used by every module so they read as one
 * system in the desktop rail and the mobile stack.
 */
export function WorkModule({
  title,
  action,
  children,
  className,
}: {
  title: string;
  /** Optional trailing header link — e.g. "All" → /conversations. */
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        'rounded-xl border border-border bg-card p-2 sm:p-2.5',
        className,
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2 px-2.5 pt-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {action ? (
          <Link
            href={action.href}
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
              FOCUS_RING,
            )}
          >
            {action.label}
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Skeleton rows for a pending module — sized to the real rows so the cross-fade
 * to content never jumps. Fades out via the caller's content fade-in (the
 * skeleton→content swap is the standard skeleton-first cross-fade).
 */
export function ModuleRowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="flex flex-col" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="flex min-h-11 items-center gap-3 px-2.5 py-2">
          <Skeleton className="size-4 shrink-0 rounded" />
          <Skeleton className="h-3.5 flex-1 rounded" />
          <Skeleton className="h-3 w-8 shrink-0 rounded" />
        </li>
      ))}
    </ul>
  );
}

/**
 * A distinct module error state — never an empty-looking panel. Offers a retry
 * (the query's `refetch`). Quiet and self-contained.
 */
export function ModuleError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'v2-interactive rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-secondary',
          FOCUS_RING,
        )}
      >
        Try again
      </button>
    </div>
  );
}

/**
 * A quiet, designed empty state — an icon, a line, and an optional soft CTA link
 * (create / browse). Deliberately understated so an empty module never shouts.
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
    <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
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
 * Activity badges. `UnreadDot` is the quiet "there's unread here" signal (a
 * small primary dot — gold on an icon-sized mark stays contrast-safe).
 * `CountBadge` is the louder numeric signal — a primary pill for the §17
 * mention count (spaces / channels) and radar unread-report counts alike, only
 * rendered when the count is > 0. `label` supplies the accessible name so a bare
 * number is never read without context.
 */
export function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      aria-label="Unread"
      className={cn('size-2 shrink-0 rounded-full bg-primary', className)}
    />
  );
}

export function CountBadge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;
  const display = count > 99 ? '99+' : String(count);
  return (
    <span
      aria-label={label ?? display}
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground"
    >
      {display}
    </span>
  );
}
