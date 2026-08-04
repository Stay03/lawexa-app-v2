'use client';

import { memo } from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { OrgCrest, PlaceCrest, SpaceCrest } from '@/v2/features/collab/kit/Crest';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { PresenceStack } from '@/v2/features/collab/kit/PresenceStack';
import { MemberAvatar } from '@/v2/features/collab/membership/MemberAvatar';
import { formatRelativeTime } from '@/v2/shell/designs/modules';
import type { InvitationAction } from './mutations';
import type { InvitationCrest, InvitationRowModel } from './row-model';

/**
 * InvitationCard — one pending invitation as a DECISION, not a list item.
 *
 * This is the most emotionally loaded object in the product: someone is asking
 * you to join their firm. It used to render as the same grey-tile row as a
 * bookmark, with the inviter reduced to a 16px avatar inside a 12px meta line
 * and nothing at all about what you would be joining. A bordered card is
 * justified here for the reason cards are usually not: each one is a separate
 * question, answered separately, and the border is what says so.
 *
 * ── THE ANATOMY ────────────────────────────────────────────────────────────
 *   (40) Ada Nwosu invited you to [crest] Firm HQ
 *        Work space · A shared workroom for the litigation team
 *        [Member]  2d                        Decline   [ Accept ]
 *
 * The inviter leads, at a size you can recognise a face at, because WHO is
 * asking is most of the decision. The headline is a sentence rather than a
 * title plus a meta fragment. The second line is whatever the payload can
 * truthfully say about the destination (see `row-model.ts` — the three
 * endpoints answer to three different depths, and none of them carries the
 * channel count the design would have liked).
 *
 * ── THE ACTIONS ARE DELIBERATELY UNEQUAL ───────────────────────────────────
 * Two same-size buttons say the two outcomes are equally likely. They are not:
 * people mostly accept invitations they were expecting. So Accept is the real
 * primary and Decline is text-weight — and on a phone Accept takes the width
 * while Decline stays a word, which also puts the destructive-ish action out
 * of the thumb's path.
 *
 * ── WHAT THIS REDESIGN MUST NOT BREAK, AND DOES NOT ────────────────────────
 * `aria-disabled`, never `disabled`: a real `disabled` yanks focus to `<body>`
 * the instant the press lands, before the card takes it away by leaving. The
 * handler's own guard is what stops a second write.
 *
 * Answering removes the card optimistically, so without a held exit it would
 * SNAP out — the asymmetric motion the house rules forbid. The `<li>` is a
 * grid whose single row interpolates `1fr → 0fr`, the repo's standing collapse,
 * with `motion-reduce` settling it instantly. The unmount is committed by the
 * list's timer, never by the animation, so the card leaves either way.
 *
 * `memo` holds because the model objects are rebuilt only when their page
 * changes, so answering one card does not re-render the other four.
 */
export const InvitationCard = memo(function InvitationCard({
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
  /** Which action is in flight for THIS card, if any. */
  busy: InvitationAction | null;
  /** `true` while the card plays its exit before unmounting. */
  exiting: boolean;
  /** The row's own key is enough — the screen resolves its FLAT list position
   *  from it, because `index` here is section-relative. */
  onRespond: (row: InvitationRowModel, action: InvitationAction) => void;
}) {
  const age = formatRelativeTime(row.createdAt, now);
  const disabled = busy !== null || exiting;
  const Mark = row.titleMark;

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
      {/* Two boxes, and the split is load-bearing.
          The GRID ITEM carries `min-w-0` (a grid track's automatic minimum is
          its content's minimum, which for a truncating title is the FULL
          title) and the clip. It carries NO padding, border or margin of its
          own: all three survive a zeroed track, and would leave the card stuck
          at ~34px through its own collapse.
          The CARD carries the box AND the 8px separation from its neighbour.
          The gap lives here rather than on the list, because a `gap` belongs
          to the container and would hold its 8px open around a row that is
          collapsing — neighbours 16px apart for 150ms, then snapping to 8px at
          unmount. As the card's own margin it collapses with the track.
          `overflow-hidden` is unconditional so that margin is measured into
          the track (an overflow-visible parent would collapse it out); the
          only focusable children are the two buttons, inset 16px, so no focus
          ring can reach the clip. */}
      <div className="min-w-0 overflow-hidden">
        <div className="mb-2 rounded-xl border border-border bg-background p-4">
          <div className="flex min-w-0 items-start gap-3">
            <MemberAvatar user={row.invitedBy} size="lg" className="mt-0.5" />

            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {row.invitedBy ? (
                  <>
                    <span className="font-semibold text-foreground">
                      {row.invitedBy.name}
                    </span>
                    {' invited you to '}
                  </>
                ) : (
                  'You’ve been invited to '
                )}
                <span className="inline-flex max-w-full items-center gap-1.5 align-middle">
                  <InvitationCrestMark crest={row.crest} />
                  <span
                    className="min-w-0 truncate font-semibold text-foreground"
                    title={row.title}
                  >
                    {row.titlePrefix ? (
                      <span className="text-muted-foreground">{row.titlePrefix}</span>
                    ) : null}
                    {row.title}
                  </span>
                  {Mark ? (
                    <Mark
                      aria-label="Private"
                      className="size-3.5 shrink-0 text-muted-foreground"
                    />
                  ) : null}
                </span>
              </p>

              {row.facts.length > 0 ? (
                <MetaLine className="mt-1.5" lead={row.facts} />
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 sm:ml-13">
            <span className="inline-flex shrink-0 items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
              {row.roleLabel}
            </span>
            {row.memberCount ? (
              <PresenceStack
                members={row.memberFaces}
                total={row.memberCount.total}
                countLabel={row.memberCount.words}
                label={`${row.memberCount.words} in ${row.title}`}
              />
            ) : null}
            {age ? (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {age}
              </span>
            ) : null}

            {/* Full width on a phone so Accept can take the row and Decline
                stays a word beside it; right-anchored from `sm:` up. */}
            <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
              <Button
                variant="ghost"
                size="sm"
                className="v2-interactive shrink-0 text-muted-foreground hover:text-foreground"
                // `aria-disabled`, not `disabled`: a real `disabled` would yank
                // focus to `<body>` the instant the press lands, before the
                // card takes it away by leaving. The handler's own guard is
                // what stops a second write.
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
                className="v2-interactive flex-1 sm:flex-none"
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
        </div>
      </div>
    </li>
  );
});

/** The destination's crest, inline in the headline at 24px. */
function InvitationCrestMark({ crest }: { crest: InvitationCrest }) {
  switch (crest.kind) {
    case 'space':
      return (
        <SpaceCrest uuid={crest.uuid} name={crest.name} type={crest.type} size="sm" />
      );
    case 'organization':
      return <OrgCrest uuid={crest.uuid} name={crest.name} size="sm" />;
    case 'place':
      return <PlaceCrest uuid={crest.uuid} name={crest.name} size="sm" />;
  }
}
