import Link from 'next/link';
import { Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StatuteCitedEdge } from '@/types/case';

interface CaseStatutesSectionProps {
  statutes: StatuteCitedEdge[];
  className?: string;
  animationDelay?: number;
}

/**
 * The statutes, rules and books this judgment referred to.
 *
 * ── THESE ROWS HAVE BEEN ARRIVING AND NOTHING RENDERED THEM ───────────────
 * `statutes_cited` is on every case payload and always has been; Garkuwa
 * carries 13 of them today. No component read the field, so a reader has
 * never seen a single one.
 *
 * ── A ROW ONLY BECOMES A LINK WHEN IT IS A STATUTE WE HOLD ────────────────
 * Two conditions, and both matter for different reasons. `statute_id` says we
 * hold the act, so there is somewhere to go. `kind` says the row IS an act: a
 * rule of court and a textbook arrive in the same table, and a book rendered
 * as a link to a statute page is a wrong answer dressed as a citation. `kind`
 * is absent on rows written before it existed, and an absent kind is treated
 * as a statute, which is what those rows are.
 */
function CaseStatutesSection({
  statutes,
  className,
  animationDelay = 0,
}: CaseStatutesSectionProps) {
  const groups = groupByInstrument(statutes);
  if (groups.length === 0) return null;
  // What the count promises is what the list shows: every provision, and an
  // instrument cited with no provision counted once for itself.
  const total = groups.reduce((n, g) => n + (g.provisions.length || 1), 0);

  return (
    <div
      className={cn(
        'rounded-lg bg-muted/30 p-4',
        'animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both motion-reduce:animate-none',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Scale className="h-3.5 w-3.5" />
        <span>Referred to</span>
        <span className="tabular-nums">{total}</span>
      </div>
      <ul className="space-y-2">
        {groups.map((group) => (
          <li key={group.key} className="text-sm leading-snug">
            {group.linkable ? (
              <Link
                href={`/statutes/${group.slug}`}
                className="font-medium text-primary hover:underline"
              >
                {group.label}
              </Link>
            ) : (
              <span className="font-medium">{group.label}</span>
            )}
            {group.provisions.length > 0 && (
              <span className="text-muted-foreground"> · {group.provisions.join(', ')}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface StatuteGroup {
  key: string;
  label: string;
  slug: string | null;
  linkable: boolean;
  provisions: string[];
}

/**
 * One line per instrument, its provisions listed after it.
 *
 * A report cites the same rules a dozen times and one row per citation printed
 * "Court of Appeal Rules, 2011" twelve times in bold with the provision, the
 * only part that differs, in the muted colour beside it. Grouping puts the
 * instrument once and the provisions where the eye is already going.
 *
 * Rows join a group only when they agree on everything that decides where the
 * line goes: the title, the statute behind it and the kind. Two rows that would
 * link to different places, or that are a statute and a book under one name,
 * stay apart.
 */
function groupByInstrument(statutes: StatuteCitedEdge[]): StatuteGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, StatuteGroup>();

  for (const row of statutes) {
    if (!row) continue;
    const label = row.statute?.title ?? row.raw ?? '';
    if (!label) continue;

    const slug = row.statute?.slug ?? null;
    const linkable = isStatuteKind(row) && row.statute_id !== null && !!slug;
    const key = `${label}|${row.statute_id ?? ''}|${row.kind ?? ''}`;
    let group = byKey.get(key);
    if (!group) {
      group = { key, label, slug, linkable, provisions: [] };
      byKey.set(key, group);
      order.push(key);
    }
    // "Order 8 rule 18" twice in one report is one citation to a reader.
    const provision = row.provision?.trim();
    if (provision && !group.provisions.includes(provision)) group.provisions.push(provision);
  }

  return order.map((k) => byKey.get(k)!);
}

/** A row with no `kind` predates the column and is a statute; see above. */
function isStatuteKind(row: StatuteCitedEdge): boolean {
  return row.kind == null || row.kind === 'statute';
}

export { CaseStatutesSection };
