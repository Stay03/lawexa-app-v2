import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { CONTENT_FADE, FOCUS_RING } from './meta';

/**
 * modules/rows.tsx — the row anatomy every home module shares.
 *
 * ROW ANATOMY (researched — see Module.tsx docblock): a list row is
 * [ leading visual ] → [ primary line (+ inline context, unread dot) / secondary
 * line ] → [ trailing cluster (count badge, then relative time) ]. Two text lines
 * maximum, a calm hover tint (never a shadow), a ≥44px target on mobile, numbers
 * right-aligned and tabular. Every module composes THIS row, so a Work channel
 * and a Study bookmark line up to the same grid and an adversarial Work-vs-Study
 * diff finds one anatomy, not two.
 */

/**
 * The leading visual — a 36px rounded tile carrying the row's identity icon. One
 * tile for every identity row (spaces, channels, radars, bookmarks, recently
 * viewed, conversations) so the left edge of every list is a single rhythm and
 * the skeleton's tile lands exactly where the real one will. `tone="primary"`
 * tints it gold for the rare accent row; the default is a quiet secondary tile
 * that warms to the foreground on row hover.
 */
export function RowIconTile({
  icon: Icon,
  tone = 'default',
}: {
  icon: LucideIcon;
  tone?: 'default' | 'primary';
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
        tone === 'primary'
          ? 'bg-primary/10 text-primary'
          : 'bg-secondary text-muted-foreground group-hover:text-foreground',
      )}
    >
      <Icon className="size-[18px]" />
    </span>
  );
}

/**
 * The quiet "there's unread here" mark — a small gold dot beside the row title.
 * Gold on a 2px dot stays contrast-safe (the standing rule keeps gold to small
 * marks and never as small text).
 */
export function UnreadDot({ className }: { className?: string }) {
  return (
    <span
      aria-label="Unread"
      className={cn('size-2 shrink-0 rounded-full bg-primary', className)}
    />
  );
}

/**
 * The louder numeric signal — a gold pill for a §17 mention count / a radar's
 * unread-report count, rendered only when the count is > 0. `label` supplies the
 * accessible name so a bare number is never read without context.
 */
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

/** The list body — a plain vertical stack with the standard skeleton→content
 *  cross-fade and the horizontal inset that lines rows up under the header. */
export function ModuleList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col px-2 pb-2', CONTENT_FADE, className)}>
      {children}
    </ul>
  );
}

interface ModuleRowProps {
  /** Canonical clean path — falls through the proxy to the v1 screen. */
  href: string;
  /** The leading visual — usually a `<RowIconTile />`. */
  leading: React.ReactNode;
  /** Primary line. */
  title: string;
  /** Quiet inline context after the title (a space name, a lock icon) — kept on
   *  the primary line so the secondary line is free for a preview. */
  titleAside?: React.ReactNode;
  /** Secondary line — a preview, a type label, or a single context slot. */
  secondary?: React.ReactNode;
  /** Trailing relative time (already formatted). */
  meta?: React.ReactNode;
  /** Trailing count badge — sits before the time, right-aligned. */
  badge?: React.ReactNode;
  /** Unread bumps the title weight and shows the dot. */
  unread?: boolean;
  /** Screen-reader title override when `title` alone is ambiguous. */
  'aria-label'?: string;
}

/**
 * ONE interactive list row — the whole-row link every module renders. Truncation
 * is enforced on both text lines; the trailing cluster and leading tile never
 * shrink. `min-h-11` guarantees the 44px mobile target even for a one-line row.
 */
export function ModuleRow({
  href,
  leading,
  title,
  titleAside,
  secondary,
  meta,
  badge,
  unread,
  'aria-label': ariaLabel,
}: ModuleRowProps) {
  const hasTrailing = badge != null || (meta != null && meta !== '');
  return (
    <li>
      <Link
        href={href}
        aria-label={ariaLabel}
        className={cn(
          'group v2-interactive flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/60',
          FOCUS_RING,
        )}
      >
        {leading}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                'min-w-0 truncate text-sm text-foreground',
                unread ? 'font-semibold' : 'font-medium',
              )}
            >
              {title}
            </span>
            {unread ? <UnreadDot /> : null}
            {titleAside}
          </span>
          {secondary != null ? (
            <span className="truncate text-xs text-muted-foreground">
              {secondary}
            </span>
          ) : null}
        </span>
        {hasTrailing ? (
          <span className="flex shrink-0 items-center gap-2">
            {badge}
            {meta != null && meta !== '' ? (
              <span className="text-xs tabular-nums text-muted-foreground/70">
                {meta}
              </span>
            ) : null}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
