'use client';

import Link from 'next/link';
import { ChevronRight, Eye } from 'lucide-react';
import { BookmarkButton } from '@/components/common/BookmarkButton';
import { ShareButton } from '@/components/common/ShareButton';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { ViewFullReportButton } from './ViewFullReportButton';
import { CaseViewLimitBanner } from './CaseViewLimitBanner';
import { AddToFolderButton } from '@/components/folders';
import { cn } from '@/lib/utils';
import type { CaseDetail, RelatedCase } from '@/types/case';

/******************************************************************************
                               Types
******************************************************************************/

interface CaseBlogViewProps {
  caseData: CaseDetail;
  slug: string;
  similarCases?: RelatedCase[] | null;
  citedCases?: RelatedCase[] | null;
  citedBy?: RelatedCase[] | null;
}

/******************************************************************************
                               Sub-components
******************************************************************************/

function BlogMetadataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function BlogRelatedCaseItem({ caseItem }: { caseItem: RelatedCase }) {
  const { title, slug, citation, judgment_date, court, country } = caseItem;

  const formattedDate = judgment_date
    ? new Date(judgment_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      })
    : null;

  return (
    <li className="border-b border-border/30 last:border-b-0">
      <Link
        href={`/cases/${slug}`}
        className="group flex items-center justify-between gap-3 py-3 -mx-2 px-2 rounded-md transition-colors hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <h4 className="text-sm font-medium text-foreground group-hover:text-primary line-clamp-1 transition-colors">
            {title}
          </h4>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {citation && <span className="font-medium">{citation}</span>}
            {(court || country || formattedDate) && citation && (
              <span className="text-muted-foreground/40">|</span>
            )}
            {court && <span>{court.name}</span>}
            {country && !court && <span>{country.name}</span>}
            {formattedDate && <span className="tabular-nums">{formattedDate}</span>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

function BlogRelatedGroup({
  title,
  cases,
}: {
  title: string;
  cases: RelatedCase[];
}) {
  return (
    <div className="mb-8 last:mb-0">
      <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
        {title}
        <span className="text-sm font-normal text-muted-foreground">
          {cases.length} {cases.length === 1 ? 'case' : 'cases'}
        </span>
      </h3>
      <ul>
        {cases.map((c) => (
          <BlogRelatedCaseItem key={c.id} caseItem={c} />
        ))}
      </ul>
    </div>
  );
}

/******************************************************************************
                               Helpers
******************************************************************************/

function safeStringValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'name' in value) {
    return String((value as { name: unknown }).name);
  }
  return null;
}

function estimateReadTime(text: string | null | undefined): number {
  if (!text) return 1;
  const wordCount = text.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

/******************************************************************************
                               Component
******************************************************************************/

/**
 * Medium-style blog theme for the case view page.
 * Renders case data in a clean, editorial layout with action bar and tags at bottom.
 */
function CaseBlogView({
  caseData,
  slug,
  similarCases,
  citedCases,
  citedBy,
}: CaseBlogViewProps) {
  const {
    title,
    court,
    country,
    judgment_date,
    citation,
    tags,
    views_count,
    principles,
    body,
    excerpt,
    judges,
    topic,
    course,
    judicial_precedent,
    has_full_report,
    is_bookmarked,
    bookmarks_count,
    id,
  } = caseData;

  // Format date
  const formattedDate = judgment_date
    ? new Date(judgment_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const hasBody = body && body.trim().length > 0;
  const isLimitExceeded = caseData.limit_exceeded === true;
  const readTime = estimateReadTime(hasBody ? body : excerpt);

  // Filter valid judges
  const validJudges = (judges || []).filter(
    (j) => j && typeof j === 'object' && typeof j.name === 'string'
  );

  // Build metadata items for the Case Details section
  const metadataItems: Array<{ key: string; label: string; value: React.ReactNode }> = [];

  if (court && typeof court === 'object' && court.name) {
    metadataItems.push({
      key: 'court',
      label: 'Court',
      value: (
        <div>
          <div>{String(court.name)}</div>
          {court.abbreviation && (
            <div className="text-xs text-muted-foreground">{String(court.abbreviation)}</div>
          )}
        </div>
      ),
    });
  }

  if (country && typeof country === 'object' && country.name) {
    metadataItems.push({
      key: 'country',
      label: 'Country',
      value: (
        <div>
          <div>{String(country.name)}</div>
          {country.code && (
            <div className="text-xs text-muted-foreground">{String(country.code)}</div>
          )}
        </div>
      ),
    });
  }

  const safeCitation = safeStringValue(citation);
  if (safeCitation) {
    metadataItems.push({ key: 'citation', label: 'Citation', value: safeCitation });
  }

  const safeTopic = safeStringValue(topic);
  if (safeTopic) {
    metadataItems.push({ key: 'topic', label: 'Topic', value: safeTopic });
  }

  const safeCourse = safeStringValue(course);
  if (safeCourse) {
    metadataItems.push({ key: 'course', label: 'Course', value: safeCourse });
  }

  const safePrecedent = safeStringValue(judicial_precedent);
  if (safePrecedent) {
    metadataItems.push({ key: 'precedent', label: 'Judicial Precedent', value: safePrecedent });
  }

  const hasRelatedCases =
    (similarCases && similarCases.length > 0) ||
    (citedCases && citedCases.length > 0) ||
    (citedBy && citedBy.length > 0);

  // Build inline metadata items for header row
  const headerMeta: string[] = [];
  if (court?.name) headerMeta.push(court.name);
  if (country?.name) headerMeta.push(country.name);
  if (formattedDate) headerMeta.push(formattedDate);
  if (safeCitation) headerMeta.push(safeCitation);
  if (views_count > 0) headerMeta.push(`${views_count} ${views_count === 1 ? 'view' : 'views'}`);
  headerMeta.push(`${readTime} min read`);

  return (
    <article>
      {/* ── Header ── */}
      <header className="mb-0">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-3">
          {title}
        </h1>

        {/* Inline metadata */}
        {headerMeta.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground mb-6">
            {headerMeta.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-border select-none">·</span>}
                {item}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* ── Action Bar (Medium-style) ── */}
      <div className="flex items-center justify-between border-y border-border/60 py-3 mb-8">
        {/* Left: views */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span className="tabular-nums">{views_count > 0 ? views_count : 0}</span>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-0.5">
          <BookmarkButton
            type="case"
            id={id}
            isBookmarked={is_bookmarked}
            bookmarksCount={bookmarks_count}
            variant="icon"
          />
          <AddToFolderButton itemType="case" itemId={id} variant="icon" />
          <ShareButton />
          <FeedbackButton
            context={{
              contentType: 'case',
              contentId: id,
              contentTitle: title,
            }}
            variant="icon"
          />
          {has_full_report && !isLimitExceeded && (
            <div className="ml-2 pl-2 border-l border-border/60">
              <ViewFullReportButton slug={slug} hasFullReport={has_full_report} />
            </div>
          )}
        </div>
      </div>

      {/* ── Legal Principles ── */}
      {principles && (
        <section className="mb-10">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
            Legal Principles
          </p>
          <blockquote className="border-l-4 border-primary/40 pl-5 py-3 bg-muted/20 rounded-r-md">
            <p className="text-base leading-relaxed italic text-foreground/90 whitespace-pre-wrap">
              {principles}
            </p>
          </blockquote>
        </section>
      )}

      {/* ── Case Body / Summary ── */}
      <section className={cn('mb-10', (metadataItems.length > 0 || validJudges.length > 0 || hasRelatedCases) && 'pb-8 border-b border-border/50')}>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
          Case Summary
        </p>
        {isLimitExceeded ? (
          <CaseViewLimitBanner limitMessage={caseData.limit_message} />
        ) : (
          <div className="prose dark:prose-invert max-w-none text-[18px] leading-relaxed">
            {hasBody ? (
              <div
                dangerouslySetInnerHTML={{ __html: body }}
                className="whitespace-pre-wrap"
              />
            ) : (
              <p className="text-muted-foreground">{excerpt}</p>
            )}
          </div>
        )}
      </section>

      {/* ── Metadata ── */}
      {metadataItems.length > 0 && (
        <section className={cn('mb-10', (validJudges.length > 0 || hasRelatedCases) && 'pb-8 border-b border-border/50')}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-4">
            Case Details
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {metadataItems.map((item) => (
              <BlogMetadataRow key={item.key} label={item.label} value={item.value} />
            ))}
          </dl>
        </section>
      )}

      {/* ── Judges ── */}
      {validJudges.length > 0 && (
        <section className={cn('mb-10', hasRelatedCases && 'pb-8 border-b border-border/50')}>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">
            Presiding {validJudges.length === 1 ? 'Judge' : 'Judges'}
          </p>
          <p className="text-sm font-medium text-foreground">
            {validJudges.map((j) => j.name).join(' \u2022 ')}
          </p>
        </section>
      )}

      {/* ── Related Cases ── */}
      {hasRelatedCases && (
        <section className="mt-10">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-6">
            Related Cases
          </p>
          {similarCases && similarCases.length > 0 && (
            <BlogRelatedGroup title="Similar Cases" cases={similarCases} />
          )}
          {citedCases && citedCases.length > 0 && (
            <BlogRelatedGroup title="Cases Cited" cases={citedCases} />
          )}
          {citedBy && citedBy.length > 0 && (
            <BlogRelatedGroup title="Cited By" cases={citedBy} />
          )}
        </section>
      )}

      {/* ── Tags (bottom) ── */}
      {tags && tags.length > 0 && (
        <section className="mt-10 pt-8 border-t border-border/40">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-3">
            Tags
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Link
                key={tag}
                href={`/cases?tags=${encodeURIComponent(tag)}`}
                className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

/******************************************************************************
                               Export
******************************************************************************/

export { CaseBlogView };
export type { CaseBlogViewProps };
