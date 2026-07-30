'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, ChevronUp, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { TreatmentTone } from '@/lib/utils/related-cases';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { SectionHeading } from './SectionHeading';

/**
 * AuthorityList — THE reference-list component of the case page. Statutes
 * cited, cases cited, cited by, and similar cases all render through it, so
 * every list on the page speaks ONE row grammar:
 *
 *   line 1  the authority's NAME        (sm, foreground)
 *   line 2  the REFERENCE — citation,   (xs, muted)
 *           provisions, or court · year
 *   right   the treatment badge when it says something, then the AFFORDANCE
 *
 * ── EVERY ROW GOES SOMEWHERE ────────────────────────────────────────────────
 * Three row kinds, told apart by their right-edge mark:
 *
 *   ›  (chevron)  we hold this authority — opens its page
 *   ⌕  (search)   we do not — opens the library with the name as the search
 *                 (owner, July 30: "clicking is like an auto search")
 *   —  (nothing)  nothing sensible to do; plain text
 *
 * The affordance is what fixes the round-2 defect where linked and unlinked
 * rows were pixel-identical and only a hover revealed which was which.
 *
 * ── LONG LISTS FOLD ─────────────────────────────────────────────────────────
 * A real enriched judgment cites SIXTY-THREE cases. The first eight rows show;
 * the rest sit behind "Show all N". The fold only exists when it hides at
 * least three rows — a button hiding one row is worse than the row.
 */

export interface AuthorityItem {
  key: string;
  name: string;
  /** Source form for the title attribute (hover shows the untransformed text). */
  nameTitle?: string;
  reference?: string | null;
  /** Opens the authority's own page. */
  href?: string | null;
  /** Opens a pre-filled library search — the unlinked-row action. */
  searchHref?: string | null;
  badge?: { label: string; tone: TreatmentTone } | null;
}

const COLLAPSED_COUNT = 8;
/** Fold only when it would hide at least this many rows. */
const FOLD_MIN_HIDDEN = 3;

export function AuthorityList({
  label,
  sub,
  id,
  items,
}: {
  label: string;
  sub?: string;
  /** The section anchor the outline rail targets. */
  id?: string;
  items: AuthorityItem[];
}) {
  const [showAll, setShowAll] = useState(false);

  if (items.length === 0) return null;

  const foldable = items.length >= COLLAPSED_COUNT + FOLD_MIN_HIDDEN;
  const visible = foldable && !showAll ? items.slice(0, COLLAPSED_COUNT) : items;

  return (
    <section id={id} aria-label={label} className="flex scroll-mt-6 flex-col gap-3">
      <SectionHeading label={label} sub={sub} count={items.length} />
      <ul className="flex flex-col divide-y divide-border/60">
        {visible.map((item, index) => (
          <li
            key={item.key}
            className={cn(
              // Rows revealed by "Show all" ease in; the first page renders plain.
              showAll &&
                index >= COLLAPSED_COUNT &&
                'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200',
            )}
          >
            <AuthorityRow item={item} />
          </li>
        ))}
      </ul>
      {foldable ? (
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          aria-expanded={showAll}
          className={cn(
            'v2-interactive inline-flex min-h-9 items-center gap-1.5 self-start rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
            FOCUS_RING,
          )}
        >
          {showAll ? (
            <>
              <ChevronUp aria-hidden className="size-3.5" />
              Show fewer
            </>
          ) : (
            <>
              <ChevronDown aria-hidden className="size-3.5" />
              Show all {items.length}
            </>
          )}
        </button>
      ) : null}
    </section>
  );
}

function AuthorityRow({ item }: { item: AuthorityItem }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground" title={item.nameTitle}>
          {item.name}
        </span>
        {item.reference ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {item.reference}
          </span>
        ) : null}
      </span>
      {item.badge ? <TreatmentBadge label={item.badge.label} tone={item.badge.tone} /> : null}
    </>
  );

  const rowClass =
    'v2-interactive group flex min-h-11 items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/50';

  if (item.href) {
    return (
      <Link href={item.href} className={cn(rowClass, FOCUS_RING)}>
        {body}
        <Affordance icon="open" />
      </Link>
    );
  }

  if (item.searchHref) {
    return (
      <Link
        href={item.searchHref}
        prefetch={false}
        aria-label={`Search the library for ${item.name}`}
        title="Not in the library yet — search for it"
        className={cn(rowClass, FOCUS_RING)}
      >
        {body}
        <Affordance icon="search" />
      </Link>
    );
  }

  return <span className="flex min-h-11 items-start gap-3 px-2 py-2.5">{body}</span>;
}

/** The right-edge mark that says what clicking does — quiet until hover. */
function Affordance({ icon }: { icon: 'open' | 'search' }) {
  const Icon = icon === 'open' ? ChevronRight : Search;
  return (
    <Icon
      aria-hidden
      className="mt-1 size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground"
    />
  );
}

/** The treatment mark. Tone is carried by colour AND by the word itself, so it
 *  never depends on colour alone to be understood. */
export function TreatmentBadge({
  label,
  tone,
}: {
  label: string;
  tone: TreatmentTone;
}) {
  return (
    <span
      className={cn(
        'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'neutral' && 'bg-secondary text-muted-foreground',
        tone === 'caution' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
        tone === 'negative' && 'bg-destructive/15 text-destructive',
      )}
    >
      {label}
    </span>
  );
}
