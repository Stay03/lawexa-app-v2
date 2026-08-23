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
 */
export function JudgmentSheet({ caseRef, open, onOpenChange }: JudgmentSheetProps) {
  const { data, isLoading } = useCase(caseRef?.slug, { enabled: open });
  const caseDetail = data?.data;
  const judgmentText =
    caseDetail?.full_report?.full_text ?? caseDetail?.body ?? null;

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
          <SheetDescription>
            {[caseRef?.court, caseRef?.country].filter(Boolean).join(' · ') ||
              'Full judgment text'}
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
          ) : judgmentText ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {judgmentText}
            </p>
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
