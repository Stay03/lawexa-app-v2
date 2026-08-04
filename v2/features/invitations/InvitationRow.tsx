'use client';

import { memo } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MemberAvatar } from '@/v2/features/spaces/membership/MemberAvatar';
import { formatRelativeTime } from '@/v2/shell/designs/modules';
import type { InvitationAction } from './mutations';
import type { InvitationRowModel } from './row-model';

/**
 * InvitationRow — one pending invitation, in the house row anatomy with the
 * decision pair on the right. Rows, not cards: the whole wave holds ONE
 * density (DIRECTION 8), and an inbox of five bordered cards reads busier than
 * the decision it is asking for.
 *
 * ── THE META LINE ANSWERS THE THREE QUESTIONS PEOPLE ACTUALLY ASK ──────────
 * WHAT is it (the context — the parent space, the organization's type), AS
 * WHAT am I being invited (the role), WHO invited me (avatar + name), and HOW
 * OLD is it (a relative age, right-anchored like every other v2 trail). A
 * three-week-old invitation from someone you don't recognise is a different
 * decision from one that arrived this morning, and the row says which.
 *
 * ── THE EXIT ───────────────────────────────────────────────────────────────
 * Answering removes the row optimistically, so without a held exit it would
 * SNAP out — the asymmetric motion the house rules forbid. The `<li>` is a
 * grid whose single row interpolates `1fr → 0fr`, the repo's standing collapse,
 * with `motion-reduce` settling it instantly. The unmount is committed by the
 * list's timer, never by the animation, so the row leaves either way.
 *
 * `memo` holds because the model objects are rebuilt only when their page
 * changes, so answering one row does not re-render the other four.
 *
 * Phase-5 W4, 2026-08-04.
 */
export const InvitationRow = memo(function InvitationRow({
  row,
  now,
  index,
  busy,
  exiting,
  onRespond,
}: {
  row: InvitationRowModel;
  /** Frozen clock for the relative age (React Compiler lint). */
  now: number;
  /** Section-relative position — the entrance stagger ONLY. The screen owns
   *  the flat index the exit holdover needs. */
  index: number;
  /** Which action is in flight for THIS row, if any. */
  busy: InvitationAction | null;
  /** `true` while the row plays its exit before unmounting. */
  exiting: boolean;
  /** The row's own key is enough — the screen resolves its FLAT list position
   *  from it, because `index` here is section-relative. */
  onRespond: (row: InvitationRowModel, action: InvitationAction) => void;
}) {
  const Icon = row.icon;
  const age = formatRelativeTime(row.createdAt, now);
  const disabled = busy !== null || exiting;

  return (
    <li
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none',
        exiting ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
        // The entrance class is dropped while exiting: `animate-in` carries
        // `fill-mode-both`, so a finished entrance keeps asserting opacity 1
        // and would win over the collapse.
        !exiting &&
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200',
      )}
      style={exiting ? undefined : { animationDelay: `${Math.min(index, 14) * 25}ms` }}
    >
      {/* `min-w-0` on the grid item: a grid track's automatic minimum is its
          content's minimum, which for a truncating title is the FULL title. */}
      <div
        className={cn(
          'flex min-w-0 flex-col gap-3 px-2 py-3 sm:flex-row sm:items-center',
          exiting && 'overflow-hidden',
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"
          >
            <Icon className="size-[18px]" />
          </span>

          <div className="min-w-0 flex-1">
            <p
              className="truncate text-[15px] font-medium text-foreground"
              title={row.title}
            >
              {row.title}
            </p>

            <p className="mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                {row.context ? (
                  <>
                    <span className="min-w-0 truncate">{row.context}</span>
                    <Dot />
                  </>
                ) : null}
                <span className="shrink-0 capitalize">as {row.roleLabel}</span>
                {row.invitedBy ? (
                  <>
                    <Dot />
                    <span className="inline-flex min-w-0 shrink items-center gap-1">
                      <MemberAvatar
                        user={row.invitedBy}
                        size="sm"
                        className="size-4 shrink-0"
                      />
                      <span className="min-w-0 truncate">{row.invitedBy.name}</span>
                    </span>
                  </>
                ) : null}
              </span>
              {age ? <span className="shrink-0 tabular-nums">{age}</span> : null}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 pl-12 sm:pl-0">
          <Button
            variant="ghost"
            size="sm"
            className="v2-interactive"
            // `aria-disabled`, not `disabled`: a real `disabled` would yank
            // focus to `<body>` the instant the press lands, before the row
            // takes it away by leaving. The handler's own guard is what stops
            // a second write.
            aria-disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onRespond(row, 'decline');
            }}
          >
            {busy === 'decline' && (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            )}
            Decline
          </Button>
          <Button
            size="sm"
            className="v2-interactive"
            aria-disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onRespond(row, 'accept');
            }}
          >
            {busy === 'accept' && (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            )}
            Accept
          </Button>
        </div>
      </div>
    </li>
  );
});

/** The meta line's separator — decorative, never read aloud. */
function Dot() {
  return (
    <span aria-hidden className="shrink-0 text-muted-foreground/40">
      ·
    </span>
  );
}
