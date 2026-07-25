'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';
import { formatTreatment, type RelatedCaseDisplay } from '@/lib/utils/related-cases';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatCaseDate } from '../case-row-model';

/**
 * The three citation sets on a case page.
 *
 * They are one component because they are one design: a heading and a list of
 * authorities. v1 rendered "Similar cases" with no heading at all in reader mode
 * (a bare list under "Related Cases") while the other two got subheadings, so a
 * reader could not tell what they were looking at.
 *
 * ── TWO ROWS THAT ARE NOT LINKS ─────────────────────────────────────────────
 * A `cited_cases` edge can point at a case we do not hold (`cited_case_id` is
 * null), and then all we have is the raw citation text. Those rows render as
 * TEXT, not as a dead link — a link that goes nowhere is worse than no link. The
 * shared `citedEdgeToDisplay` mapper already encodes that as `href === null`.
 *
 * ── TREATMENT IS THE POINT ──────────────────────────────────────────────────
 * "Overruled" and "Followed" are not decoration on a citation, they are the
 * reason a lawyer reads the list. The badge carries a tone (neutral / caution /
 * negative) from the shared `formatTreatment`, and an unknown value — the
 * backend may extend the enum — is title-cased and shown neutrally rather than
 * dropped.
 */
export function RelatedCaseList({
  title,
  description,
  cases,
}: {
  title: string;
  description?: string;
  cases: RelatedCaseDisplay[];
}) {
  if (cases.length === 0) return null;

  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <div className="px-1">
        <h2 className="doc-heading">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <ul className="flex flex-col divide-y divide-border/60">
        {cases.map((item) => (
          <li key={item.key}>
            <RelatedCaseRow item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RelatedCaseRow({ item }: { item: RelatedCaseDisplay }) {
  const year = formatCaseDate(item.judgmentDate, 'year');
  const treatment = formatTreatment(item.treatment);

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-foreground">{item.title}</span>
        {item.court || year ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {[item.court?.name, year].filter(Boolean).join(' · ')}
          </span>
        ) : null}
      </span>
      {treatment ? <TreatmentBadge label={treatment.label} tone={treatment.tone} /> : null}
    </>
  );

  if (!item.href) {
    return (
      <span className="flex min-h-11 items-start gap-3 px-2 py-2.5 text-muted-foreground">
        {body}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'v2-interactive group flex min-h-11 items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary/50',
        FOCUS_RING,
      )}
    >
      {body}
    </Link>
  );
}

/** The treatment mark. Tone is carried by colour AND by the word itself, so it
 *  never depends on colour alone to be understood. */
function TreatmentBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'neutral' | 'caution' | 'negative';
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
