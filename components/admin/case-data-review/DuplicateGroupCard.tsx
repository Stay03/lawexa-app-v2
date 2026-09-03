'use client';

import Link from 'next/link';
import { Bookmark, Eye, FileText, Gavel, ShieldCheck, SplitSquareHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FixStateChip } from './FixPreview';
import {
  differingFields,
  formatDate,
  groupSourceVerdict,
  isVerified,
  sourceProviders,
} from './model';
import type { GroupSourceVerdict } from './model';
import type { CaseReviewRow, DuplicateGroup } from '@/types/admin-case-data-review';

/** The fields worth comparing between two copies of the same case. */
const COMPARED = [
  'title',
  'citation',
  'judgment_date',
  'court',
  'content',
  'source',
] as const;
type Compared = (typeof COMPARED)[number];

/**
 * Two or more cases that look like copies, side by side.
 *
 * A GROUP IS EVIDENCE, NEVER AN INSTRUCTION. Production holds one citation,
 * `(2013) 15 NWLR (PT. 1378) 455`, sitting on two genuinely different
 * judgments, so a screen that offered to merge a group would eventually fuse
 * two unrelated cases. There is no merge endpoint and this screen asks for
 * none. It shows a person what differs and lets them decide.
 *
 * The differing fields are marked, because with two near-identical rows the
 * work is finding the one character that is not the same.
 */
export function DuplicateGroupCard({ group }: { group: DuplicateGroup }) {
  const comparable = group.cases.map((row) => ({
    title: row.title,
    citation: row.citation ?? '',
    judgment_date: row.judgment_date ?? '',
    court: row.court?.name ?? '',
    content: `${row.has_full_report}/${row.judges_count}`,
    source: sourceProviders(row).join(','),
  }));
  const differing = differingFields<Record<Compared, string>>(comparable, [...COMPARED]);
  const verdict = groupSourceVerdict(group);

  return (
    <article className="rounded-xl border bg-card p-4">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">
          {group.case_count} copies of the same case
        </h3>
        <span className="text-xs text-muted-foreground">
          {differing.size === 0
            ? 'Identical on every field shown'
            : `${differing.size} ${differing.size === 1 ? 'field differs' : 'fields differ'}`}
        </span>
      </header>

      <SourceVerdictLine verdict={verdict} />

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {group.cases.map((row) => (
          <DuplicateCase key={row.id} row={row} differing={differing} />
        ))}
      </div>
    </article>
  );
}

/**
 * What the providers say about the group, above the copies rather than on one
 * of them, because it is a fact about the pair and not about either record.
 *
 * Only two of the five states earn a line. `all_verified` and `none` say
 * nothing the copies do not already show, and a line that appears on every
 * group stops being read.
 */
function SourceVerdictLine({ verdict }: { verdict: GroupSourceVerdict }) {
  if (verdict.kind === 'same_document') {
    return (
      <p className="mt-2 flex items-start gap-1.5 rounded-md bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          One {verdict.provider} document imported twice. Same source file behind
          both copies, so this is a duplicate at the source rather than a guess
          from matching fields.
        </span>
      </p>
    );
  }

  if (verdict.kind === 'different_reports') {
    return (
      <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        <SplitSquareHorizontal className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Verified as DIFFERENT reports ({verdict.externalIds.join(' and ')}), so
          these are probably two judgments sharing a name. Check before treating
          them as copies.
        </span>
      </p>
    );
  }

  if (verdict.kind === 'one_verified') {
    return (
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Only <span className="tabular-nums">#{verdict.caseId}</span> carries a
          source document. It is the copy to keep.
        </span>
      </p>
    );
  }

  return null;
}

function DuplicateCase({
  row,
  differing,
}: {
  row: CaseReviewRow;
  differing: Set<Compared>;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/admin/cases/${row.id}`}
          className={cn(
            'break-words text-sm font-medium hover:text-primary',
            differing.has('title') && 'rounded bg-amber-100 px-1 dark:bg-amber-950/60'
          )}
        >
          {row.title}
        </Link>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          #{row.id}
        </span>
      </div>

      {/* The mark hugs the text rather than the row: a highlight that runs the
          full width reads as a filled bar and stops pointing at anything. */}
      <p className="mt-1 break-words text-xs text-muted-foreground">
        <span
          className={cn(
            differing.has('citation') &&
              'rounded bg-amber-100 px-1 dark:bg-amber-950/60'
          )}
        >
          {row.citation || 'No citation'}
        </span>
      </p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className={cn(differing.has('court') && 'font-medium text-foreground')}>
          {row.court?.name ?? 'No court'}
        </span>
        <span
          className={cn(differing.has('judgment_date') && 'font-medium text-foreground')}
        >
          {formatDate(row.judgment_date)}
        </span>
      </div>

      <div
        className={cn(
          'mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs',
          differing.has('content') ? 'font-medium text-foreground' : 'text-muted-foreground'
        )}
      >
        <span className="inline-flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" aria-hidden />
          {row.has_full_report ? 'Has judgment text' : 'No judgment text'}
        </span>
        <span className="inline-flex items-center gap-1">
          <Gavel className="h-3.5 w-3.5" aria-hidden />
          {row.judges_count}
        </span>
      </div>

      {/* Provenance sits with the judgment facts because that is what it
          qualifies: not how much text a copy holds, but where the text came
          from. The unverified state is spelled out rather than left blank, so
          the absence reads as a finding instead of a gap in the screen. */}
      <div
        className={cn(
          'mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs',
          differing.has('source') ? 'font-medium text-foreground' : 'text-muted-foreground'
        )}
      >
        <span className="inline-flex items-center gap-1">
          <ShieldCheck
            className={cn('h-3.5 w-3.5', isVerified(row) && 'text-emerald-600 dark:text-emerald-400')}
            aria-hidden
          />
          {isVerified(row)
            ? `Verified by ${sourceProviders(row).join(', ')}`
            : 'No source document'}
        </span>
      </div>

      {/* The counts that settle it: the copy people actually opened is the copy
          to keep. Emphasised on the copy that leads, so the answer is visible
          without arithmetic. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {row.views_count.toLocaleString()}{' '}
          {row.views_count === 1 ? 'view' : 'views'}
        </span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Bookmark className="h-3.5 w-3.5" aria-hidden />
          {row.bookmarks_count.toLocaleString()} saved
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <FixStateChip fix={row.fix} />
        {row.problems.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {row.problems.length}{' '}
            {row.problems.length === 1 ? 'problem' : 'problems'}
          </span>
        )}
      </div>
    </div>
  );
}
