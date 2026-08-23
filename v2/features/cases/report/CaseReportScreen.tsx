'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { extractViewLimitError, isNotFoundError } from '@/lib/utils/api-error';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { casesQueries } from '../queries';
import { formatCaseName } from '../case-name';
import { formatCaseDate } from '../case-row-model';
import { CaseText } from '../detail/case-text';
import {
  CASE_COLUMN,
  CaseDocumentSkeleton,
  CaseErrorState,
  CaseHardLimitState,
  CaseNotFoundState,
} from '../detail/states';
import '../detail/case-document.css';

/**
 * CaseReportScreen — the full judgment.
 *
 * Its own route rather than a section of the case page, for one practical
 * reason: a full report is the whole judgment, often tens of thousands of words,
 * and putting it behind a link means a reader who only wants the holding never
 * downloads it. The case page links here; this links back.
 *
 * The text is rendered by the SAME `CaseText` renderer as the summary, so the
 * two are typographically identical and neither is ever handed to the browser as
 * HTML. v1 had two near-identical string-building formatters (one per surface)
 * that had already drifted — the report's recognised more heading words than the
 * summary's, so the same paragraph rendered differently on the two pages.
 */
export function CaseReportScreen({ slug }: { slug: string }) {
  const query = useQuery(casesQueries.report(slug));
  const detail = query.data?.data ?? null;
  const report = detail?.full_report ?? null;
  const rawTitle = detail ? detail.display_title || detail.title : null;
  const title = rawTitle ? formatCaseName(rawTitle) : null;

  /**
   * THE WAY BACK IS THE BAR'S, NOT THE PAGE'S (phase 7). This screen carried a
   * "Back to the case" chip at y76 under a bar that showed the same title
   * again: two titles and, with the drawer, three ways out. The shell's bar now
   * owns the back arrow (`/cases/{slug}` is one hop up from
   * `/cases/{slug}/report`, so the address alone knows it) and the judgment's
   * own masthead owns the title. Nothing is published to the header from here.
   */

  if (query.isPending) {
    return (
      <div className={CASE_COLUMN}>
        <CaseDocumentSkeleton />
      </div>
    );
  }

  if (query.isError) {
    const limit = extractViewLimitError(query.error);
    // A case that is not there is not a failed request. Same screen for both
    // told readers to retry something that will never succeed.
    const missing = isNotFoundError(query.error);
    return (
      <div className={CASE_COLUMN}>
        {limit ? (
          <CaseHardLimitState limit={limit} />
        ) : missing ? (
          <CaseNotFoundState />
        ) : (
          <CaseErrorState onRetry={() => void query.refetch()} />
        )}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={CASE_COLUMN}>
        <CaseNotFoundState />
      </div>
    );
  }

  const date = formatCaseDate(detail.judgment_date, 'long');
  const updated = report ? formatCaseDate(report.updated_at, 'long') : '';

  return (
    <div className={CASE_COLUMN}>
      <div className="v2-case-doc flex flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <article className="flex flex-col gap-8">
          <header className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Full judgment
            </p>
            <h1 className="doc-title text-foreground" title={rawTitle ?? undefined}>
              {title}
            </h1>
            {detail.citation ? (
              <p className="doc-citation">{detail.citation}</p>
            ) : null}
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              {[detail.court?.name, detail.country?.name, date]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {detail.judges.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Before: </span>
                {detail.judges
                  .map(
                    (judge) =>
                      formatCaseName(judge.name) +
                      (judge.role ? ` (${judge.role})` : ''),
                  )
                  .join(', ')}
              </p>
            ) : null}
          </header>

          {report?.full_text?.trim() ? (
            <div className="doc-prose">
              <CaseText value={report.full_text} />
            </div>
          ) : (
            // Reachable by URL even when no report exists (the case page only
            // links here when `has_full_report` is true), so it needs a real
            // answer rather than an empty page.
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-5">
              <p className="text-sm font-medium text-foreground">
                No full judgment yet
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                This case has a summary but the full text has not been added to the
                library.
              </p>
              <Link
                href={`/cases/${slug}`}
                className={cn(
                  'v2-interactive text-sm font-medium text-primary transition-colors hover:underline',
                  FOCUS_RING,
                )}
              >
                Read the case summary
              </Link>
            </div>
          )}

          {updated ? (
            <footer className="border-t border-border/60 pt-4 text-xs text-muted-foreground">
              Last updated {updated}
            </footer>
          ) : null}
        </article>
      </div>
    </div>
  );
}

/** The route fallback — the same pulsing document shape as the live screen. */
export function CaseReportFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading the full judgment
      </span>
      <div aria-hidden inert className={CASE_COLUMN}>
        <CaseDocumentSkeleton />
      </div>
    </>
  );
}
