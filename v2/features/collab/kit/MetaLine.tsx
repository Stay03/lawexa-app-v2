import { Fragment, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * MetaLine — the two-zone meta line every collab row speaks in: a LEAD of
 * facts that truncates under pressure, and a right-anchored TRAIL that never
 * does. Within each zone the facts are joined by one shared separator dot.
 *
 * It exists because the dot had been re-declared privately in three row files
 * (`SpaceRow`, `SpaceScreen`, `InvitationRow`) as three byte-identical `Dot()`
 * helpers — a set that reads as a set only until someone tunes one of them.
 * The separator is `aria-hidden`, so it never reaches a screen reader as the
 * word "middle dot", and `shrink-0`, so it can never be the element that
 * collapses when the line runs out of room.
 *
 * ── WHY THE ZONES ARE ARRAYS ───────────────────────────────────────────────
 * The caller passes facts, not punctuation. Absent facts (`null`, `undefined`,
 * `false`, `''`) are dropped BEFORE the joining, so a row missing its middle
 * fact renders "Work · Personal", never "Work ·  · Personal" — the failure
 * every hand-rolled copy of this line had to guard against on its own. The
 * corollary is a constraint on callers: an ELEMENT that may itself render
 * `null` must not be passed, because presence is decided here while emptiness
 * would only be discovered one level down — leaving a dangling separator. Gate
 * it at the call site instead.
 *
 * ── STRINGS TRUNCATE, ELEMENTS DO NOT ──────────────────────────────────────
 * A plain string fact is wrapped so it can ellipsize (in the lead) or hold its
 * width (in the trail). An element is passed through untouched: something like
 * a row of channel chips already owns its overflow behaviour, and a wrapper
 * imposing `overflow:hidden` would clip it instead of ellipsizing it.
 *
 * ── IT RENDERS DIVS, NOT SPANS ─────────────────────────────────────────────
 * A meta line reads like text, but its facts are not all phrasing content:
 * `PresenceStack` builds on `AvatarGroup`, which renders a `<div>`, and a
 * `<div>` inside a `<span>` is invalid. So the line and its zones are `<div>`s
 * and only the string facts are wrapped in `<span>`s. An `<a>` accepts flow
 * content, so a whole-row link still nests correctly; a `<p>` does not, so a
 * meta line must be a SIBLING of a paragraph, never inside one.
 *
 * No skeleton ships with this: a meta line is text inside a row, and the row's
 * own skeleton already reserves its two bars at the right widths.
 */

/** Kept out of the render path: `0` is a legitimate fact, `false` is not. */
function isRendered(fact: ReactNode): boolean {
  return fact !== null && fact !== undefined && fact !== false && fact !== '';
}

function Zone({
  facts,
  className,
  factClassName,
}: {
  facts: readonly ReactNode[];
  className: string;
  factClassName: string;
}) {
  const shown = facts.filter(isRendered);
  if (shown.length === 0) return null;
  return (
    <div className={className}>
      {shown.map((fact, index) => (
        // Positional by nature: the facts are a fixed-shape list per row, never
        // reordered, so the index IS the identity.
        <Fragment key={index}>
          {index > 0 ? (
            <span aria-hidden className="shrink-0 text-muted-foreground/40">
              ·
            </span>
          ) : null}
          {typeof fact === 'string' ? (
            <span className={factClassName}>{fact}</span>
          ) : (
            fact
          )}
        </Fragment>
      ))}
    </div>
  );
}

export function MetaLine({
  lead,
  trail,
  className,
}: {
  /** The facts that identify the row. Truncates first. */
  lead: readonly ReactNode[];
  /** The facts that measure it — counts, ages. Holds its width. */
  trail?: readonly ReactNode[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground',
        className,
      )}
    >
      <Zone
        facts={lead}
        className="flex min-w-0 flex-1 items-center gap-2"
        factClassName="min-w-0 truncate"
      />
      {trail ? (
        <Zone
          facts={trail}
          className="flex shrink-0 items-center gap-2 tabular-nums"
          factClassName="shrink-0"
        />
      ) : null}
    </div>
  );
}
