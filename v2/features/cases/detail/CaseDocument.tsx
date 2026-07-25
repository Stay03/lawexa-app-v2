'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';
import { citedEdgeToDisplay, relatedToDisplay } from '@/lib/utils/related-cases';
import type { CaseDetail } from '@/types/case';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { formatCaseDate } from '../case-row-model';
import { CaseActions } from './CaseActions';
import { CaseText } from './case-text';
import { RelatedCaseList } from './RelatedCases';
import { ViewLimitNotice } from './states';
import './case-document.css';

/**
 * CaseDocument — THE case reading surface. Singular, on purpose.
 *
 * ── WHAT v1 HAD, AND WHY IT IS GONE ─────────────────────────────────────────
 * v1 rendered the same case three ways: a default CARD view (six bordered cards
 * — principles, body, a metadata grid, judges, and each related set), a READER
 * MODE document behind a persisted toggle, and a third "blog" theme visible only
 * to superadmins. About 950 lines of component for one page, three code paths
 * that could disagree (and did: the card view treated `body` as HTML, the reader
 * treated it as plain text), and a toggle asking every reader to choose a layout
 * for a document that has only one correct one.
 *
 * A judgment is a document. It gets the document. The toggle, the persisted
 * reader-mode store, the superadmin palette switcher and the card view are all
 * dropped rather than ported — this is the layout users switched INTO.
 *
 * ── WHAT SURVIVED, DELIBERATELY ─────────────────────────────────────────────
 * Everything a reader actually uses: the heading block with court / country /
 * date / citation, clickable tags, the judges line, the topic, the holding, the
 * summary, all three citation sets with their treatment marks, the view-limit
 * states, and the route to the full judgment.
 *
 * ── NO BOXES ────────────────────────────────────────────────────────────────
 * Sections are told apart by space and a quiet heading, never by a border — the
 * standing rule from the home redesign, and doubly right here: six rectangles
 * around one judgment is exactly the chrome that made the card view unreadable.
 */
export function CaseDocument({ detail }: { detail: CaseDetail }) {
  const title = getCaseDisplayTitle(detail);
  const date = formatCaseDate(detail.judgment_date, 'long');
  const isLimited = detail.limit_exceeded === true;

  const similar = (detail.similar_cases ?? []).map(relatedToDisplay);
  const cited = (detail.cited_cases ?? []).map(citedEdgeToDisplay);
  const citedBy = (detail.cited_by ?? []).map(relatedToDisplay);

  // The body is the summary; the excerpt is the honest fallback when a case has
  // not been written up yet. Neither is invented when both are absent.
  const summary = detail.body?.trim() || detail.excerpt?.trim() || '';

  /** The heading's one meta line, in reading order, with the gaps closed up. */
  const meta = [detail.court?.name, detail.country?.name, date].filter(
    (part): part is string => Boolean(part),
  );

  // The `.v2-case-doc` scope is applied by `CaseScreen` on the wrapper that also
  // holds `CaseAsk`, so the ask cluster's heading matches the document's. This
  // component only owns its own structure.
  return (
    <article className="flex flex-col gap-8">
      {/* ── Heading block ───────────────────────────────────────────────── */}
      <header className="flex flex-col gap-3">
        <h1 className="doc-title text-foreground">{title}</h1>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {/* Keyed by POSITION, not by value: a court and a country can carry the
              same string (a country-named court), and two identical keys in one
              list is a real bug hiding behind an unlikely input. */}
          {meta.map((part, index) => (
            <span key={index} className="inline-flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden className="text-muted-foreground/40">
                  ·
                </span>
              ) : null}
              {part}
            </span>
          ))}
          {detail.views_count > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground/70">
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <Eye aria-hidden className="size-3.5" />
              <span className="tabular-nums">{detail.views_count}</span>
            </span>
          ) : null}
        </p>

        {detail.tags && detail.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {detail.tags.map((tag) => (
              <li key={tag}>
                {/* A tag is a FILTER, so it is a real link to the filtered list —
                    shareable, middle-clickable, and announced as a link. v1 made
                    these buttons nested inside the row's own link. */}
                <Link
                  href={`/cases?tags=${encodeURIComponent(tag)}`}
                  className={cn(
                    'v2-interactive inline-flex min-h-7 items-center rounded-full bg-secondary px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground',
                    FOCUS_RING,
                  )}
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <CaseActions
          caseId={detail.id}
          slug={detail.slug}
          title={title}
          isBookmarked={detail.is_bookmarked}
          bookmarksCount={detail.bookmarks_count}
          hasFullReport={detail.has_full_report === true && !isLimited}
        />
      </header>

      {/* ── Bench and topic — one quiet line each, above the reading ────── */}
      {detail.judges.length > 0 || detail.topic ? (
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {detail.judges.length > 0 ? (
            <p>
              <span className="font-medium text-foreground">Before: </span>
              {detail.judges.map((judge) => judge.name).join(', ')}
            </p>
          ) : null}
          {detail.topic ? (
            <p>
              <span className="font-medium text-foreground">Topic: </span>
              {detail.topic}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── The holding ─────────────────────────────────────────────────── */}
      {detail.principles?.trim() ? (
        <section aria-label="Legal principles" className="flex flex-col gap-2">
          <h2 className="doc-heading">Legal principles</h2>
          <div className="doc-holding">
            <div className="doc-prose">
              <CaseText value={detail.principles} />
            </div>
          </div>
        </section>
      ) : null}

      {/* ── The summary, or the wall ────────────────────────────────────── */}
      <section aria-label="Case summary" className="flex flex-col gap-2">
        <h2 className="doc-heading">Case summary</h2>
        {isLimited ? (
          <ViewLimitNotice message={detail.limit_message} />
        ) : summary ? (
          <div className="doc-prose">
            <CaseText value={summary} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This case has no written summary yet.
          </p>
        )}
      </section>

      {/* ── Authorities ─────────────────────────────────────────────────── */}
      {similar.length > 0 || cited.length > 0 || citedBy.length > 0 ? (
        <div className="flex flex-col gap-7">
          <RelatedCaseList
            title="Cases cited"
            description="Authorities this judgment relied on."
            cases={cited}
          />
          <RelatedCaseList
            title="Cited by"
            description="Later judgments that cite this one."
            cases={citedBy}
          />
          <RelatedCaseList
            title="Similar cases"
            description="Cases on comparable facts or points of law."
            cases={similar}
          />
        </div>
      ) : null}
    </article>
  );
}
