'use client';

import { useState, useEffect } from 'react';
import { useReaderModeStore } from '@/lib/stores/readerModeStore';
import { useCaseViewThemeStore } from '@/lib/stores/caseViewThemeStore';
import { cn } from '@/lib/utils';
import { CaseDocumentView } from './CaseDocumentView';
import { CaseBlogView } from './CaseBlogView';
import type { CaseDetail, RelatedCase, CitedCaseEdge, CitedByCase } from '@/types/case';

interface ReaderModeWrapperProps {
  children: React.ReactNode;
  className?: string;
  /** Case data for document view - required for Reader Mode to show document layout */
  caseData?: CaseDetail;
  /** Case slug for navigation links in document view */
  slug?: string;
  /** Similar cases for document view */
  similarCases?: RelatedCase[] | null;
  /** Outgoing citation edges from this case */
  citedCases?: CitedCaseEdge[] | null;
  /** Cases that cite this case */
  citedBy?: CitedByCase[] | null;
}

/**
 * Wrapper component that applies document-style reading experience
 * when Reader Mode is enabled. Shows document layout instead of cards.
 */
function ReaderModeWrapper({
  children,
  className,
  caseData,
  slug,
  similarCases,
  citedCases,
  citedBy,
}: ReaderModeWrapperProps) {
  const [mounted, setMounted] = useState(false);
  const isReaderModeEnabled = useReaderModeStore((state) => state.isReaderModeEnabled);
  const caseViewTheme = useCaseViewThemeStore((state) => state.caseViewTheme);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't apply reader mode styling until after hydration to avoid flash
  const shouldApplyReaderMode = mounted && isReaderModeEnabled;
  // Blog theme only applies when reader mode is off
  const shouldApplyBlogTheme = mounted && !isReaderModeEnabled && caseViewTheme === 'blog';

  return (
    <div
      // Only set data-reader-mode when active (avoids false string value)
      {...(shouldApplyReaderMode && { 'data-reader-mode': 'true' })}
      className={cn(
        // Smooth transition for reader mode
        'reader-mode-transition',
        // Normal mode: preserve component spacing
        !shouldApplyReaderMode && !shouldApplyBlogTheme && 'space-y-6',
        // Reader mode: full-bleed on mobile (negative margin to cancel parent p-4), normal padding on larger screens
        shouldApplyReaderMode && '-mx-4 px-4 py-6 sm:mx-0 sm:p-6 md:p-10 lg:p-12',
        // Blog theme: minimal padding
        shouldApplyBlogTheme && 'py-2',
        className
      )}
    >
      {shouldApplyReaderMode && caseData && slug ? (
        <CaseDocumentView
          caseData={caseData}
          slug={slug}
          similarCases={similarCases}
          citedCases={citedCases}
          citedBy={citedBy}
        />
      ) : shouldApplyBlogTheme && caseData && slug ? (
        <CaseBlogView
          caseData={caseData}
          slug={slug}
          similarCases={similarCases}
          citedCases={citedCases}
          citedBy={citedBy}
        />
      ) : (
        children
      )}
    </div>
  );
}

export { ReaderModeWrapper };
