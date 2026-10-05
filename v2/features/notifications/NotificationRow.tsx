'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import {
  AtSign,
  Bell,
  ChevronDown,
  Radar,
  Reply,
  Trash2,
  Trophy,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Notification } from '@/types/notification';
import { FOCUS_RING, formatRelativeTime } from '@/v2/shell/designs/modules';
import { useMounted } from '@/v2/shell/use-mounted';
import { presentNotification, type NotificationMark } from './presentation';

/**
 * NotificationRow — one inbox row, shared by the header bell's panel and the
 * `/notifications` page, so the two surfaces cannot disagree about what a row
 * says or what pressing it does. Everything it says comes from
 * `presentation.ts`; see that module for how a pre-deploy wordless row degrades
 * to its own kind instead of to the bare word "Notification".
 *
 * ── THE ROW'S ELEMENT IS ITS DESTINATION ──────────────────────────────────
 *  - internal → a `<Link>`: prefetchable, middle-clickable, and inside the v2
 *    shell (a mention's `/channels/{uuid}?m=` keeps its anchor).
 *  - external → an `<a target="_blank">`: an absolute URL is not ours and must
 *    not replace the app. There is no second "Open link" control; the row IS
 *    the link.
 *  - none     → a `<button>` that marks the row read and, when there is a
 *    preview, EXPANDS it in place. There is no detail page to send it to: the
 *    API stores a 140-character preview and the show endpoint returns the
 *    same text, so the row already holds everything there is.
 * A row with NOTHING to do (no destination, already read, no preview) is not a
 * control at all: a button that answers a press with nothing is worse than
 * plain text. In every case `onActivate` runs first, which is where the row is
 * marked read and a channel transcript is warmed.
 *
 * ── DELETE IS A SIBLING, VISIBLE WHEREVER THERE IS NO HOVER ───────────────
 * Never nested inside the row's link or button (invalid HTML, and an
 * unreachable target for the keyboard). On a fine pointer that can hover it
 * fades in with the row's hover or focus; everywhere else (a phone, a tablet)
 * it is simply always there, because a capability that only works with a mouse
 * is not a capability. Its space is reserved either way, so nothing shifts.
 *
 * ── MOTION ─────────────────────────────────────────────────────────────────
 * Read state moves on persistent nodes only: the unread dot scales out, the
 * tint and the tile fade, and nothing mounts or unmounts. On the page a row
 * enters with the shared list stagger and leaves through the grid-row collapse
 * (`BookmarkRow` documents both, including why the entrance class must be
 * dropped while exiting). Every tween is `motion-reduce` aware.
 *
 * ── TIME ───────────────────────────────────────────────────────────────────
 * The compact house form ("5m", `formatRelativeTime`) against a clock frozen by
 * the caller, with the absolute date on hover. Both are drawn only once
 * MOUNTED: a relative time printed by the server would be the server's clock
 * and zone, and a mismatch on hydration is React error #418 (the Work page,
 * 2026-10-05). The line keeps its height while empty, so nothing moves.
 *
 * `memo`, because a press on one row re-renders the list; every callback a
 * caller passes must be stable.
 */

/**
 * One glyph per kind, so the list is scannable at a glance — and ONLY a glyph.
 * Gold is the single accent in this product and it already means "unread"
 * here, so a mention is not additionally coloured: colour carries read state,
 * shape carries kind, and the two never compete.
 */
const MARK_ICONS: Readonly<Record<NotificationMark, LucideIcon>> = {
  mention: AtSign,
  reply: Reply,
  invite: UserPlus,
  // A quiz lobby has opened somewhere the reader can play. Still only a glyph:
  // the row is time-critical (a lobby self-cancels after ten minutes) but that
  // is what its own words say, not something a second colour may claim.
  quiz: Trophy,
  radar: Radar,
  general: Bell,
};

/** Where the row sits. The page is a reading column with rounded rows and a
 *  list entrance; the panel is a full-bleed list inside a popover or sheet. */
export type NotificationRowDensity = 'page' | 'panel';

const DENSITY = {
  page: {
    item: 'pb-0.5',
    frame: 'rounded-lg',
    body: 'rounded-lg px-2 py-3',
    action: 'pr-0',
  },
  panel: {
    item: '',
    frame: '',
    body: 'py-3 pl-4',
    action: 'pr-2',
  },
} as const;

/** The absolute timestamp for the hover title, in the reader's own locale. */
const ABSOLUTE_TIME = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const NotificationRow = memo(function NotificationRow({
  notification,
  index,
  now,
  density,
  exiting = false,
  onActivate,
  onDelete,
}: {
  notification: Notification;
  /** The row's position in the rendered list: the entrance stagger, and where
   *  an exiting row is held. */
  index: number;
  /** Frozen clock for the relative time, from the caller's lazy `useState`. */
  now: number;
  density: NotificationRowDensity;
  /** `true` while the row plays its exit before unmounting. */
  exiting?: boolean;
  /** Runs before the row's own navigation (mark read, warm). MUST be stable. */
  onActivate: (notification: Notification, index: number) => void;
  /** MUST be stable. */
  onDelete: (notification: Notification, index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const presentation = presentNotification(notification);
  const { destination, preview } = presentation;
  const unread = !notification.read_at;
  const expandable = destination.kind === 'none' && preview !== null;
  const actionable = destination.kind !== 'none' || unread || expandable;
  const MarkIcon = MARK_ICONS[presentation.mark];
  const styles = DENSITY[density];

  const activate = () => {
    if (exiting) return;
    if (expandable) setExpanded((open) => !open);
    onActivate(notification, index);
  };

  const content = (
    <>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 motion-reduce:transition-none',
          unread ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground',
        )}
      >
        <MarkIcon className="size-[18px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {/* Said, not only shown: the dot is decoration and this is the fact. */}
          {unread ? <span className="sr-only">Unread: </span> : null}
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm text-foreground',
              unread ? 'font-semibold' : 'font-medium',
            )}
            title={presentation.title}
          >
            {presentation.title}
          </span>
          {/* A PERSISTENT node, so the dot scales out on read instead of
              vanishing between frames. */}
          <span
            aria-hidden
            className={cn(
              'size-2 shrink-0 rounded-full bg-primary transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
              unread ? 'scale-100 opacity-100' : 'scale-0 opacity-0',
            )}
          />
        </span>

        {/* No preview, no placeholder. A pre-deploy row carries no message and
            must not be given one; its title already states what it is. */}
        {preview !== null ? (
          expandable ? (
            // Height, not `line-clamp`, so the reveal tweens in BOTH
            // directions: a clamp has nothing to interpolate and snaps.
            <span
              className={cn(
                'mt-0.5 block overflow-hidden text-xs text-muted-foreground transition-[max-height] duration-300 ease-out motion-reduce:transition-none',
                expanded ? 'max-h-[8lh]' : 'max-h-[2lh]',
              )}
            >
              {preview}
            </span>
          ) : (
            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
              {preview}
            </span>
          )
        ) : null}

        <span className="mt-1 flex h-4 items-center gap-1 text-xs text-muted-foreground/70">
          <NotificationTime iso={notification.created_at} now={now} />
          {expandable ? (
            <ChevronDown
              aria-hidden
              className={cn(
                'size-3.5 transition-transform duration-200 motion-reduce:transition-none',
                expanded && 'rotate-180',
              )}
            />
          ) : null}
        </span>
      </span>
    </>
  );

  const bodyClasses = cn(
    'flex min-w-0 flex-1 items-start gap-3 text-left',
    styles.body,
  );
  const interactiveClasses = cn(
    bodyClasses,
    'v2-interactive transition-colors hover:bg-secondary/50',
    FOCUS_RING,
  );

  const body =
    destination.kind === 'internal' ? (
      <Link href={destination.href} onClick={activate} className={interactiveClasses}>
        {content}
      </Link>
    ) : destination.kind === 'external' ? (
      <a
        href={destination.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={activate}
        className={interactiveClasses}
      >
        {content}
      </a>
    ) : actionable ? (
      <button
        type="button"
        onClick={activate}
        aria-expanded={expandable ? expanded : undefined}
        className={interactiveClasses}
      >
        {content}
      </button>
    ) : (
      <div className={bodyClasses}>{content}</div>
    );

  return (
    <li
      data-notification-id={notification.id}
      // THE EXIT: a persistent grid collapse, `1fr → 0fr`, with `overflow-
      // hidden` only while leaving so a resting row never clips a focus ring.
      // The unmount is committed by the caller's timer, so under reduced motion
      // the row still leaves, just without the fold.
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none',
        exiting ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        density === 'page' &&
          !exiting &&
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200',
      )}
      // Capped at 14 so a deep page never staggers into a visible delay.
      style={
        density === 'page' && !exiting
          ? { animationDelay: `${Math.min(index, 14) * 25}ms` }
          : undefined
      }
    >
      {/* The grid item. `min-w-0` lets the track resolve to the column's
          width, so a long title truncates instead of widening the row
          (`BookmarkRow`). The gap between page rows is padding HERE, inside
          the item, so it folds away with the row instead of snapping shut
          after it (`InvitationCard`'s rule). */}
      <div className={cn('min-w-0', styles.item, exiting && 'overflow-hidden')}>
        <div
          className={cn(
            'group relative flex min-w-0 items-start transition-colors duration-200 motion-reduce:transition-none',
            styles.frame,
            unread && 'bg-primary/5',
          )}
        >
          {body}
          <div className={cn('flex shrink-0 items-start pt-3.5 pl-1', styles.action)}>
            <Button
              variant="ghost"
              size="icon"
              // `aria-disabled`, not `disabled`: a real `disabled` drops focus to
              // `<body>` the instant the press lands, before the caller can move
              // it somewhere useful. The guard in the handler stops a second press.
              aria-disabled={exiting}
              aria-label={`Delete notification: ${presentation.title}`}
              onClick={() => {
                if (!exiting) onDelete(notification, index);
              }}
              className={cn(
                'size-9 rounded-full text-muted-foreground/70 transition-opacity duration-150 hover:text-foreground motion-reduce:transition-none',
                '[@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100',
              )}
            >
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
});

/**
 * The row's time, drawn only once mounted (see the docblock). `<time>` carries
 * the machine-readable instant either way.
 */
function NotificationTime({ iso, now }: { iso: string; now: number }) {
  const mounted = useMounted();
  const instant = Date.parse(iso);
  const absolute = mounted && !Number.isNaN(instant) ? ABSOLUTE_TIME.format(instant) : undefined;

  return (
    <time dateTime={iso} title={absolute} className="tabular-nums">
      {mounted ? formatRelativeTime(iso, now) : null}
    </time>
  );
}
