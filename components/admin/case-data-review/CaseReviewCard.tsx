'use client';

import Link from 'next/link';
import { Bookmark, ExternalLink, Eye, FileText, Gavel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FixPreview } from './FixPreview';
import { formatDate } from './model';
import type {
  CaseProblem,
  CaseProblemKey,
  CaseReviewRow,
} from '@/types/admin-case-data-review';

interface CaseReviewCardProps {
  row: CaseReviewRow;
  /** The problem currently being filtered on, so its chip can lead. */
  activeProblem: CaseProblemKey | null;
}

/**
 * One case, with EVERY problem it carries rather than only the one filtered on.
 *
 * That was a deliberate ask of the API: a table showing just the active filter
 * hides that fixing one defect leaves three behind, and most of these cases
 * carry several. The chip for the active filter leads so the row still answers
 * "why am I looking at this one".
 */
export function CaseReviewCard({ row, activeProblem }: CaseReviewCardProps) {
  const problems = orderProblems(row.problems, activeProblem);

  return (
    <article className="rounded-xl border bg-card p-4 transition-colors duration-150 hover:border-primary/30 motion-reduce:transition-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/admin/cases/${row.id}`}
            className="group inline-flex items-start gap-1.5 font-medium text-foreground hover:text-primary"
          >
            <span className="break-words">{row.short_title || row.title}</span>
            <ExternalLink
              className="mt-1 h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none"
              aria-hidden
            />
          </Link>
          {row.short_title && row.short_title !== row.title && (
            <p className="mt-0.5 break-words text-xs text-muted-foreground">{row.title}</p>
          )}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          #{row.id}
        </span>
      </div>

      <dl className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <MetaItem label="Court">{row.court?.name ?? 'No court'}</MetaItem>
        <MetaItem label="Judgment date">{formatDate(row.judgment_date)}</MetaItem>
        <MetaItem label="Citation">{row.citation || 'No citation'}</MetaItem>
      </dl>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" aria-hidden />
          {row.has_full_report ? 'Has judgment text' : 'No judgment text'}
        </span>
        <span className="inline-flex items-center gap-1">
          <Gavel className="h-3.5 w-3.5" aria-hidden />
          {row.judges_count > 0
            ? `${row.judges_count} ${row.judges_count === 1 ? 'judge' : 'judges'}`
            : 'No judges'}
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {row.views_count.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Bookmark className="h-3.5 w-3.5" aria-hidden />
          {row.bookmarks_count.toLocaleString()}
        </span>
        {row.created_by && <span>Added by {row.created_by.name}</span>}
      </div>

      {problems.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {problems.map((problem) => (
            <li key={problem.key}>
              <ProblemChip problem={problem} isActive={problem.key === activeProblem} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <FixPreview fix={row.fix} />
      </div>
    </article>
  );
}

/** Label and value as one inline pair, readable to a screen reader as a pair. */
function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1">
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </span>
  );
}

/**
 * `needs_source_content` is the difference between work someone can do tonight
 * and work that waits on the provider, so it earns a visible difference rather
 * than a tooltip.
 */
function ProblemChip({ problem, isActive }: { problem: CaseProblem; isActive: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[11px] font-medium',
        isActive
          ? 'border-primary/40 bg-primary/10 text-primary'
          : problem.needs_source_content
            ? 'border-dashed border-border bg-transparent text-muted-foreground'
            : 'border-border bg-muted text-foreground/80'
      )}
    >
      {problem.label}
    </span>
  );
}

/** The filtered problem first; the rest keep the server's order. */
function orderProblems(
  problems: CaseProblem[],
  activeProblem: CaseProblemKey | null
): CaseProblem[] {
  if (!activeProblem) return problems;
  const active = problems.filter((p) => p.key === activeProblem);
  if (active.length === 0) return problems;
  return [...active, ...problems.filter((p) => p.key !== activeProblem)];
}
