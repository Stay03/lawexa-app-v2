'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowUpRight, CalendarDays, Scale } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import type { CaseDetail } from '@/types/case';
import { formatCaseName } from '@/v2/features/cases/case-name';
import { casesQueries } from '@/v2/features/cases/queries';

/**
 * CasePreview — the body of a case-mention preview (desktop hover-card + touch
 * popover share it). It fetches LAZILY: this component only mounts inside the
 * Radix content, which Radix renders only once the preview opens — so a merely
 * visible case link never fetches, and a stream never triggers a request. Data
 * flows through the `casesQueries.preview` leaf (the LEAN `getBySlug` payload —
 * no related citation sets, since a transcript can mention a dozen cases and a
 * hover must not pull a dozen judgments' worth of them), so a second open is
 * instant from cache.
 *
 * Three explicit, component-scoped states (module design system): a skeleton
 * shaped like the resolved card (skeleton-first, no layout jump), a DISTINCT
 * error state (icon + message + retry, never a shimmer), and the content. The
 * "Open case" action is always present — the whole link navigates on desktop,
 * but on touch tapping opens this preview instead of navigating, so the explicit
 * action is how a touch user reaches the case page.
 */

const SUMMARY_MAX = 600;

/** Inert HTML → plain text. `DOMParser` builds a non-live document that never
 *  loads resources or runs scripts, so API-authored HTML is stripped safely. */
function htmlToText(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Deterministic "Mon D, YYYY". Parses with `Date.parse` (no nondeterministic
 *  zero-arg `Date` in render) and returns '' for anything missing/unparseable. */
function formatJudgmentDate(iso: string | null): string {
  if (!iso) return '';
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return '';
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** The preview blurb — the holding (principles) if present, else the excerpt,
 *  else the body — stripped and length-capped so the card stays light (the full
 *  text lives one tap away on the case page). */
function buildSummary(detail: CaseDetail): string {
  const text = htmlToText(detail.principles || detail.excerpt || detail.body || '');
  if (text.length <= SUMMARY_MAX) return text;
  return `${text.slice(0, SUMMARY_MAX).replace(/\s+\S*$/, '').trimEnd()}…`;
}

export function CasePreview({ slug, href }: { slug: string; href: string }) {
  const query = useQuery(casesQueries.preview(slug));
  const detail = query.data?.data ?? null;

  if (query.isPending) {
    return <PreviewSkeleton />;
  }

  if (query.isError || !detail) {
    return <PreviewError href={href} onRetry={() => void query.refetch()} />;
  }

  return <PreviewBody detail={detail} href={href} />;
}

function PreviewBody({ detail, href }: { detail: CaseDetail; href: string }) {
  // The readable name alone — the citation is reference data the card's meta
  // row does not need, and the all-caps fused form defeated the line clamp.
  const title = formatCaseName(detail.display_title || detail.title);
  const court = detail.court?.name?.trim() ?? '';
  const date = formatJudgmentDate(detail.judgment_date);
  const summary = useMemo(() => buildSummary(detail), [detail]);
  const hasMeta = court !== '' || date !== '';

  return (
    <div className="flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <div className="flex flex-col gap-2 p-4">
        <h3 className="text-popover-foreground line-clamp-2 text-sm font-semibold leading-snug">
          {title}
        </h3>

        {hasMeta ? (
          <div className="text-muted-foreground border-border flex flex-wrap items-center gap-x-3 gap-y-1 border-b pb-2.5 text-xs">
            {court ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Scale aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{court}</span>
              </span>
            ) : null}
            {date ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays aria-hidden className="size-3.5 shrink-0" />
                <span className="tabular-nums">{date}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        {summary ? (
          <p className="text-popover-foreground/90 max-h-[280px] overflow-y-auto overscroll-contain pr-1 text-[0.8125rem] leading-relaxed">
            {summary}
          </p>
        ) : null}
      </div>

      <Link
        href={href}
        className="text-primary border-border v2-interactive focus-visible:ring-ring flex min-h-11 items-center justify-between gap-2 border-t px-4 py-2.5 text-xs font-medium transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        Open case
        <ArrowUpRight aria-hidden className="size-4 shrink-0" />
      </Link>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="flex flex-col p-4" role="status">
      <span className="sr-only">Loading case preview…</span>
      <div aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-4 w-3/4 rounded" />
        <div className="border-border flex gap-3 border-b pb-2.5">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
        <div className="flex flex-col gap-1.5 pt-0.5">
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-4/5 rounded" />
        </div>
      </div>
    </div>
  );
}

function PreviewError({ href, onRetry }: { href: string; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-start gap-2 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      role="status"
    >
      <div className="text-foreground flex items-center gap-2 text-sm">
        <AlertCircle aria-hidden className="text-muted-foreground size-4 shrink-0" />
        <span>Couldn&apos;t load this case.</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="border-border text-foreground v2-interactive focus-visible:ring-ring rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2"
        >
          Try again
        </button>
        <Link
          href={href}
          className="text-primary v2-interactive focus-visible:ring-ring rounded-md px-2.5 py-1 text-xs font-medium transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2"
        >
          Open case
        </Link>
      </div>
    </div>
  );
}
