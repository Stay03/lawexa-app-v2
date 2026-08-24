'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useCase } from '@/lib/hooks/useAdminCases';
import { caseTextParagraphs } from '@/lib/utils/case-text';
import { indexRendered, locateAllQuotes } from '@/lib/utils/quote-locator';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';
import type { PrincipleCaseRef } from '@/types/admin-case-principles';

/** Named so the paint rule in globals.css can find it. */
const HIGHLIGHT_NAME = 'judgment-passage';

interface JudgmentSheetProps {
  caseRef: PrincipleCaseRef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The principle to find and scroll to. The reviewer's own row. */
  highlight?: string | null;
  /**
   * The passage the backend lifted from this judgment, when it has one.
   *
   * Preferred over `highlight` because it is CUT FROM the report rather than
   * written about it, so it is present in the rendered text by construction.
   * A principle is often a summary and legitimately absent — searching it made
   * the panel report "not word for word" on rows where nothing was wrong.
   */
  quote?: string | null;
}

/**
 * The judgment beside the queue, so checking a principle against its source
 * does not cost the reviewer their place. Fetched lazily on open — full
 * reports run to hundreds of kilobytes and most rows never need one.
 *
 * ── IT HAD NEVER ONCE SHOWN A JUDGMENT ────────────────────────────────────
 * `GET /cases/{slug}` returns `full_report` ONLY when asked with
 * `include_full_report`. This sheet did not ask, so `full_report` was always
 * absent, the fallback below took `body` — the case SUMMARY — and the panel
 * displayed it under the heading "Full judgment text".
 *
 * It went unnoticed because `body` is prose and renders perfectly well. The
 * reviewer's whole job is judging a principle against the judgment it came
 * from, and the screen was quietly showing them a different document.
 *
 * The fallback stays: a case with no judgment on file should show its summary
 * rather than an empty panel. But the heading now tells the truth about which
 * of the two is on screen.
 */
export function JudgmentSheet({
  caseRef,
  open,
  onOpenChange,
  highlight,
  quote,
}: JudgmentSheetProps) {
  const { data, isLoading } = useCase(caseRef?.slug, {
    enabled: open,
    includeFullReport: true,
  });
  const caseDetail = data?.data;
  const fullReport = caseDetail?.full_report?.full_text ?? null;
  const judgmentText = fullReport ?? caseDetail?.body ?? null;
  /* Shared with the public case reader through `lib/utils`, because the lint
     boundary forbids this v1 screen importing the v2 renderer and the two must
     not drift — v1 already had three renderers for this one field. */
  const paragraphs = judgmentText ? caseTextParagraphs(judgmentText) : [];

  const [found, setFound] = useState<'pending' | 'hit' | 'many' | 'miss'>('pending');

  /**
   * Find the reviewer's principle in the judgment, scroll to it, paint it.
   *
   * ── A CALLBACK REF, NOT AN EFFECT ─────────────────────────────────────
   * The work needs the rendered DOM, so it cannot happen during render, and
   * setting state from inside an effect is banned in this codebase. A ref
   * callback fires exactly when the node attaches — which is the moment the
   * paragraphs exist — and is the sanctioned place to read the DOM and record
   * what was found. React 19 runs the returned function on detach, so the
   * highlight is cleaned up when the sheet closes.
   *
   * Re-runs when the principle changes, because the callback's identity does.
   *
   * ── WHY CSS.highlights AND NOT <mark> ─────────────────────────────────
   * It is a PAINT-ONLY overlay: no elements, no attributes, nothing for React
   * to reconcile. Wrapping the match would mutate a DOM React owns, and writing
   * markers into the judgment is forbidden anyway — the same text feeds the
   * search index and the AI's view of the case.
   */
  /* The stored passage when there is one, the principle's own words otherwise.
     Which of the two was searched changes what a miss MEANS, so it is carried
     rather than inferred: a principle that is not verbatim is ordinary, a
     stored passage that is missing from its own judgment is a real fault. */
  const needle = quote ?? highlight ?? null;
  const searchedStoredQuote = Boolean(quote);

  const attachBody = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container || !needle) return;
      const registry = typeof CSS !== 'undefined' ? CSS.highlights : undefined;
      const ranges = locateAllQuotes(indexRendered(container), needle);
      if (ranges.length === 0) {
        setFound('miss');
        return;
      }
      setFound(ranges.length > 1 ? 'many' : 'hit');
      registry?.set(HIGHLIGHT_NAME, new Highlight(...ranges));
      /* Centring sidesteps the sticky header: a Range carries no scroll-margin,
         so `block: 'start'` would tuck the passage under the heading. */
      ranges[0].startContainer.parentElement?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
      // Braces matter: `delete` returns a boolean and a ref cleanup must return
      // nothing.
      return () => {
        registry?.delete(HIGHLIGHT_NAME);
      };
    },
    [needle],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* The width override must repeat the data-[side=right]:sm: variant —
          the base SheetContent sets its width behind that variant, so a bare
          max-w utility loses to it. */}
      <SheetContent
        side="right"
        className="w-full gap-0 data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="leading-snug">
            {caseRef ? getCaseDisplayTitle(caseRef) : 'Judgment'}
          </SheetTitle>
          {/* Says which document is actually on screen. The judgment and the
              summary are different things and a reviewer has to know which one
              they are reading a principle against.
              It also reports whether the principle was FOUND in that document.
              A principle that cannot be located is itself worth knowing at the
              moment of approving it, and silently scrolling nowhere would read
              as the feature being broken. */}
          <SheetDescription>
            {[
              [caseRef?.court, caseRef?.country].filter(Boolean).join(' · '),
              isLoading ? null : fullReport ? 'Full judgment' : 'Summary only — no judgment on file',
              /* A miss means two different things and the reviewer needs the
                 right one. Missing the PRINCIPLE is ordinary — most are
                 summaries of a holding rather than quotations of it. Missing
                 the STORED PASSAGE is a fault worth reporting, because that
                 text was cut out of this very judgment and should be in it. */
              needle && !isLoading
                ? found === 'miss'
                  ? searchedStoredQuote
                    ? 'The stored passage is not in this text'
                    : 'This principle is not word for word in the text'
                  : found === 'many'
                    ? 'Appears more than once — showing the first'
                    : null
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-2.5" aria-busy>
              {Array.from({ length: 14 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className={i % 5 === 4 ? 'h-4 w-2/3' : 'h-4 w-full'}
                />
              ))}
            </div>
          ) : paragraphs.length > 0 ? (
            /* Paragraphs, not the stored value. A judgment is stored as markup,
               so printing it straight into one element showed the reviewer 6,145
               raw tags beginning `<p style="line-height: 150%;">`. It read
               cleanly for as long as this sheet was fetching the case SUMMARY,
               which is plain prose — a data bug hiding a rendering one. */
            <div ref={attachBody} className="space-y-3 text-sm leading-relaxed">
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No judgment text is on file for this case.
            </p>
          )}
        </div>

        {caseRef && (
          <SheetFooter className="border-t">
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/admin/cases/${caseRef.slug}`}
                target="_blank"
                rel="noopener"
              >
                <ExternalLink />
                Open the full case page
              </Link>
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
