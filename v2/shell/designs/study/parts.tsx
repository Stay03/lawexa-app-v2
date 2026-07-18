'use client';

import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Shared building blocks for the Study home tab modules (owner #34), so every
 * module — Quiz, Study spaces, Recent bookmarks, Recent conversations — reads as
 * ONE system: the same card chrome, header, focus ring, entrance, and
 * empty/error treatments. Keeping these here is why the modules stay short and
 * can never drift on spacing or state styling.
 */

/** Unified focus ring across every interactive element in the Study tab. */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * The tab's ONE signature entrance (owner rule: a single subtle staggered
 * reveal). A soft fade + 8px rise; `fill-mode-both` holds each element hidden
 * through its stagger delay so nothing pre-flashes, and `motion-safe` + the
 * globals reduced-motion guard settle everything to its natural, fully-visible
 * state instantly for users who ask for less motion. Callers add a per-element
 * `animationDelay` for the stagger and `duration-*` for pacing.
 */
export const REVEAL =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-both motion-safe:ease-out';

/**
 * Compact relative time for a module row. Pure — `now` is threaded in from a lazy
 * `useState` initializer at the call site so no `Date.now()`/`new Date()` runs in
 * render (React Compiler lint), and the timestamp is parsed with the
 * deterministic `Date.parse`.
 */
export function formatRelativeTime(iso: string, now: number): string {
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
 * A Study module card — the shared shell: a rounded, bordered surface with a
 * quiet uppercase header (icon + title) and an optional "see all" action link.
 * The body is passed as children so each module owns its own list / states.
 */
export function ModuleCard({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  /** Optional trailing link (e.g. "All" → the full v1 route). */
  action?: { label: string; href: string };
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
      <div className="flex items-center justify-between gap-2 px-4 pb-1.5 pt-3.5">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="size-3.5 shrink-0" aria-hidden />
          {title}
        </h2>
        {action ? (
          <Link
            href={action.href}
            className={cn(
              'v2-interactive -mr-1.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
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
 * A quiet, centered state line for a module body (empty state). Distinct from the
 * error treatment below so an empty result never reads as a failure.
 */
export function ModuleEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * The module ERROR treatment — visually distinct from empty (owner rule: never
 * error-as-empty), with a real retry affordance so the failure is recoverable
 * in place.
 */
export function ModuleError({
  children,
  onRetry,
}: {
  children: React.ReactNode;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          'v2-interactive rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
          FOCUS_RING,
        )}
      >
        Try again
      </button>
    </div>
  );
}

/**
 * Skeleton rows for a loading list body — a quiet fading stack sized to the real
 * rows, so the cross-fade to content has zero layout jump. Reduced motion keeps
 * them static (no pulse) via the globals guard.
 */
export function ModuleSkeletonRows({ rows = 3 }: { rows?: number }) {
  // A gentle top-to-bottom opacity fade mirrors the other v2 list skeletons
  // (Design B recents, the jurisdiction picker) so the tab feels of one piece.
  const opacities = [0.9, 0.7, 0.5, 0.35, 0.25, 0.2];
  return (
    <ul className="flex flex-col px-2 pb-2">
      {Array.from({ length: rows }).map((_, index) => (
        <li
          key={index}
          className="flex items-center gap-3 px-2 py-2.5"
          style={{ opacity: opacities[index] ?? 0.2 }}
        >
          <div className="size-8 shrink-0 rounded-lg bg-muted motion-safe:animate-pulse" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="h-3.5 w-2/3 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-3 w-2/5 rounded bg-muted motion-safe:animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}
