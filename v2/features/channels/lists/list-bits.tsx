import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { SlimUser } from '@/types/collab';
import { LawexaAvatar, MemberAvatar } from '../ui/avatars';

/**
 * list-bits — the two atoms the Lists index cards AND the detail header share:
 * the completion mark and the creator identity label. One home so the two
 * surfaces cannot drift.
 *
 * ── THE EMERALD IS GONE ────────────────────────────────────────────────────
 * The old bar tinted to `emerald-500` at 100 %, which put a THIRD accent into
 * a system whose whole rule is that one accent carries every signal. The
 * resolution keeps the meaning and drops the colour: the ring fills in GOLD,
 * and completion is said by a shape — the ring closes and a check takes the
 * centre — plus the count line beside it. Nothing about "done" depended on the
 * hue; it depended on being able to see, in one glance, that the circle was
 * full. A shape survives colour-blindness and a monochrome print; a second
 * accent survives neither, and costs the system its one-accent rule.
 */

/* ── The ring ─────────────────────────────────────────────────────────────── */

interface RingGeometry {
  /** Outer box in px — the SVG viewBox is normalised, so this is the only size. */
  box: number;
  stroke: number;
  label: string;
}

const RING = {
  sm: { box: 28, stroke: 3, label: 'text-[9px]' },
  md: { box: 36, stroke: 3.5, label: 'text-[10px]' },
} satisfies Record<string, RingGeometry>;

type RingSize = keyof typeof RING;

/**
 * ListRing — an SVG donut of checked / total, filling clockwise from twelve
 * o'clock and resolving to a `Check` at 100 %.
 *
 * ── ACCESSIBILITY ──────────────────────────────────────────────────────────
 * `role="progressbar"` with the real min / max / now on the WRAPPER and the
 * drawing `aria-hidden`: the picture is the presentation, the wrapper is the
 * semantics. `aria-label` names what is being counted, because a bare "3 of 8"
 * is not a sentence anyone can act on.
 *
 * ── AN EMPTY LIST HAS NO PROGRESS ──────────────────────────────────────────
 * `total === 0` draws the track alone with no `aria-valuenow` — the value is
 * genuinely undefined, and 0 % would be a claim that nothing is done rather
 * than that there is nothing to do.
 */
export function ListRing({
  checked,
  total,
  size = 'md',
  className,
}: {
  checked: number;
  total: number;
  size?: RingSize;
  className?: string;
}) {
  const geometry = RING[size];
  const ratio = total > 0 ? Math.min(1, Math.max(0, checked / total)) : 0;
  const complete = total > 0 && checked >= total;

  // Normalised 36-unit viewBox, so one path serves every size.
  const radius = 18 - geometry.stroke / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={total > 0 ? checked : undefined}
      aria-label={
        total > 0 ? `${checked} of ${total} items complete` : 'No items yet'
      }
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: geometry.box, height: geometry.box }}
    >
      <svg
        aria-hidden
        viewBox="0 0 36 36"
        className="size-full -rotate-90"
        fill="none"
      >
        <circle
          cx="18"
          cy="18"
          r={radius}
          strokeWidth={geometry.stroke}
          className="stroke-secondary"
        />
        {ratio > 0 ? (
          <circle
            cx="18"
            cy="18"
            r={radius}
            strokeWidth={geometry.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            className="stroke-primary transition-[stroke-dashoffset] duration-200 ease-out motion-reduce:transition-none"
          />
        ) : null}
      </svg>

      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums text-muted-foreground"
      >
        {complete ? (
          <Check className="size-3.5 text-primary" strokeWidth={3} />
        ) : (
          <span className={geometry.label}>{total > 0 ? checked : ''}</span>
        )}
      </span>
    </span>
  );
}

/** The count in words beside a ring — "3 of 8", or the done chip at 100 %. */
export function ListRingLabel({
  checked,
  total,
  className,
}: {
  checked: number;
  total: number;
  className?: string;
}) {
  if (total === 0) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>No items yet</span>
    );
  }
  if (checked >= total) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary',
          className,
        )}
      >
        <Check aria-hidden className="size-3" strokeWidth={3} />
        All done
      </span>
    );
  }
  return (
    <span className={cn('text-xs tabular-nums text-muted-foreground', className)}>
      {`${checked} of ${total} done`}
    </span>
  );
}

/* ── Identity ─────────────────────────────────────────────────────────────── */

/** The identity behind a list or item: Lawexa when `is_ai` (NEVER inferred
 *  from `creator === null` — that is a removed account; digest §F.3). */
export function ListCreatorLabel({
  isAi,
  creator,
  className,
}: {
  isAi: boolean;
  creator: SlimUser | null;
  className?: string;
}) {
  const name = isAi ? 'Lawexa' : (creator?.name ?? 'Unknown');
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground',
        className,
      )}
    >
      {isAi ? <LawexaAvatar size="sm" /> : <MemberAvatar user={creator} size="sm" />}
      <span className="truncate">{name}</span>
    </span>
  );
}
