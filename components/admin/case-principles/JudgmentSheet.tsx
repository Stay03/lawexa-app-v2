'use client';

import Link from 'next/link';
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
import { getCaseDisplayTitle } from '@/lib/utils/case-title';
import type { PrincipleCaseRef } from '@/types/admin-case-principles';

interface JudgmentSheetProps {
  caseRef: PrincipleCaseRef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
export function JudgmentSheet({ caseRef, open, onOpenChange }: JudgmentSheetProps) {
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
              they are reading a principle against. */}
          <SheetDescription>
            {[
              [caseRef?.court, caseRef?.country].filter(Boolean).join(' · '),
              isLoading ? null : fullReport ? 'Full judgment' : 'Summary only — no judgment on file',
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
            <div className="space-y-3 text-sm leading-relaxed">
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
