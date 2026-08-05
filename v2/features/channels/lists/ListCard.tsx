'use client';

import { memo } from 'react';

import { cn } from '@/lib/utils';
import type { TaskListSummary } from '@/types/collab';
import { MetaLine } from '@/v2/features/collab/kit/MetaLine';
import { RelativeTime } from '../ui/RelativeTime';
import { ListCreatorLabel, ListRing, ListRingLabel } from './list-bits';

/**
 * ListCard — one task list on the index.
 *
 * ── WHY A CARD HERE, WHEN EVERY OTHER v2 INDEX IS ROWS ─────────────────────
 * Because a list IS a container. Every other collab index points at a single
 * object — a message, a file, a channel — and a row is the right silhouette
 * for one thing. A task list is a box with a fill level, and a card with a
 * ring reads as "a container, this full" at a glance, which is the one fact
 * the index exists to convey. That is also why the old rows needed fixing:
 * they had NO leading mark at all, breaking the rhythm every other v2 list
 * keeps, and the fill level was buried in a thin bar under the title.
 *
 * ── THE RING IS THE LEADING MARK ───────────────────────────────────────────
 * 36px, the same box every other v2 leading mark occupies, so the left edge of
 * the grid lines up with the left edge of every list in the product — and it
 * carries information instead of repeating the word "list" as a glyph.
 *
 * ── THE WHOLE CARD IS ONE CONTROL, AND IT IS VALID MARKUP ──────────────────
 * The card is a `<div>` with a stretched `<button>` over it, not a `<button>`
 * wrapping the content. A `<button>`'s content model is PHRASING content, and
 * this card's body is flow content — `MetaLine` renders `<div>`s by contract
 * (its own docblock says so: `PresenceStack` builds on `AvatarGroup`, which is
 * a `<div>`). The old index row put an `<h3>` and a `<p>` inside a `<button>`
 * and got away with it because browsers repair it; a heading inside a button
 * is silently dropped from the accessibility tree, so it was never doing the
 * job it looked like it was doing.
 *
 * The stretched control is the kit's own idiom in a different dress —
 * `ChoiceCards` makes its whole card one control with a `<label>` and an
 * `sr-only` input for exactly this reason. One tab stop, one explicit
 * accessible name, the whole card as the hit area, and the focus ring on the
 * card via `has-[:focus-visible]` so keyboard focus lights the object rather
 * than an invisible rectangle.
 *
 * The trade is that the overlay sits above the card's text, so the exact
 * timestamp behind `RelativeTime`'s `title` is not reachable by pointer HERE.
 * It stays reachable where it matters — the list's own detail header, whose
 * meta line is not under a control — and the `<time datetime>` keeps carrying
 * the machine-readable stamp regardless.
 */
export const ListCard = memo(function ListCard({
  list,
  onSelect,
  index,
}: {
  list: TaskListSummary;
  onSelect: (listUuid: string) => void;
  /** Position in the grid — drives the entrance stagger. */
  index: number;
}) {
  return (
    <div
      style={{ animationDelay: `${Math.min(index, 5) * 25}ms` }}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border bg-card p-3.5',
        'transition-colors duration-150 hover:border-primary/40 hover:bg-accent/40',
        'motion-reduce:transition-none',
        'has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:fill-mode-both motion-safe:duration-200',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <ListRing checked={list.checked_count} total={list.items_count} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-foreground transition-colors duration-150 group-hover:text-primary motion-reduce:transition-none">
            {list.title}
          </h3>
          {list.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {list.description}
            </p>
          ) : null}
          <ListRingLabel
            checked={list.checked_count}
            total={list.items_count}
            className="mt-1.5"
          />
        </div>
      </div>

      {/* Two-zone meta: identity left, time right-anchored. */}
      <MetaLine
        lead={[<ListCreatorLabel key="creator" isAi={list.is_ai} creator={list.creator} />]}
        trail={[<RelativeTime key="age" iso={list.updated_at} />]}
      />

      <button
        type="button"
        onClick={() => onSelect(list.uuid)}
        aria-label={`Open list ${list.title}`}
        className="v2-interactive absolute inset-0 rounded-xl outline-none"
      />
    </div>
  );
});
