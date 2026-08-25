'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { indexRendered, locateAllQuotes } from '@/lib/utils/quote-locator';

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
/** The highlight the case page's "Read it in the judgment" link lands on. */
const HIGHLIGHT_NAME = 'judgment-passage';

export function CaseReportScreen({ slug }: { slug: string }) {
  const query = useQuery(casesQueries.report(slug));
  const detail = query.data?.data ?? null;
  const report = detail?.full_report ?? null;

  /**
   * Arriving from a principle: open the judgment AT that passage.
   *
   * ── WHY A PRINCIPLE ID AND NOT THE TEXT ───────────────────────────────
   * The link carries `?p=<id>` and the span is looked up here. Putting the
   * passage in the URL would make a shareable link hundreds of characters of
   * judgment long, and it would let anyone highlight any text they liked on
   * our page by editing the address.
   *
   * ── WHY THE STORED SPAN AND NOT THE PRINCIPLE'S OWN WORDS ─────────────
   * The span was cut out of this very judgment, so it is present by
   * construction. A principle is usually a summary of a holding and often
   * genuinely absent — searching for it is what made the admin panel report
   * "not word for word" on rows where nothing was wrong.
   */
  const params = useSearchParams();
  const target = params.get('p');
  /* THE KEY, NOT THE RAW QUOTE. The key is the span already through the shared
     normalisation, which is exactly what the matcher ran on. The raw quote is
     lifted straight out of stored markup and can still carry undecoded
     entities — one case in the corpus holds 62 occurrences of `&#039;` — and
     this side does NOT decode entities, because it assumes the browser already
     did when it built the text nodes. Feeding it raw would silently fail to
     match on exactly those cases. Falling back to the raw span is better than
     no highlight at all when a key is missing. */
  const found = target
    ? (detail?.report_principles ?? []).find(
        (principle) => String(principle.id) === target,
      )
    : undefined;
  const quote = found?.verbatim_quote_key ?? found?.verbatim_quote ?? null;
  const [located, setLocated] = useState<'idle' | 'hit' | 'miss'>('idle');

  /**
   * A callback ref, because the work needs the rendered DOM and setting state
   * from an effect is banned here. React 19 runs the returned function on
   * detach, so the highlight is cleaned up when the reader leaves.
   *
   * `CSS.highlights` paints without touching the DOM — no elements, no
   * attributes, nothing for React to reconcile, and nothing written into
   * judgment text that also feeds the search index.
   */
  const attachReport = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container || !quote) return;
      const registry = typeof CSS !== 'undefined' ? CSS.highlights : undefined;
      const ranges = locateAllQuotes(indexRendered(container), quote);
      if (ranges.length === 0) {
        setLocated('miss');
        return;
      }
      setLocated('hit');
      registry?.set(HIGHLIGHT_NAME, new Highlight(...ranges));
      /* Centred, not `start`: a Range carries no scroll-margin, so the passage
         would otherwise sit under the sticky bar. */
      ranges[0].startContainer.parentElement?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
      return () => {
        registry?.delete(HIGHLIGHT_NAME);
      };
    },
    [quote],
  );
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
            <>
              {/* Arrived from a principle whose passage is not in this text.
                  Silence would read as a broken link, so it says so once and
                  the judgment is still there to read. */}
              {quote && located === 'miss' ? (
                <p className="mb-3 text-sm text-muted-foreground">
                  That passage could not be found in this text.
                </p>
              ) : null}
              <div ref={attachReport} className="doc-prose">
                <CaseText value={report.full_text} />
              </div>
            </>
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
