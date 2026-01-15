'use client';

import { useState, useEffect } from 'react';
import { useReaderModeStore } from '@/lib/stores/readerModeStore';
import { cn } from '@/lib/utils';
import { CaseDocumentView } from './CaseDocumentView';
import type { CaseDetail } from '@/types/case';

interface ReaderModeWrapperProps {
  children: React.ReactNode;
  className?: string;
  /** Case data for document view - required for Reader Mode to show document layout */
  caseData?: CaseDetail;
}

/**
 * Wrapper component that applies document-style reading experience
 * when Reader Mode is enabled. Shows document layout instead of cards.
 */
function ReaderModeWrapper({ children, className, caseData }: ReaderModeWrapperProps) {
  const [mounted, setMounted] = useState(false);
  const isReaderModeEnabled = useReaderModeStore((state) => state.isReaderModeEnabled);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't apply reader mode styling until after hydration to avoid flash
  const shouldApplyReaderMode = mounted && isReaderModeEnabled;

  return (
    <div
      // Only set data-reader-mode when active (avoids false string value)
      {...(shouldApplyReaderMode && { 'data-reader-mode': 'true' })}
      className={cn(
        // Smooth transition for reader mode
        'reader-mode-transition',
        // Normal mode: preserve component spacing
        !shouldApplyReaderMode && 'space-y-6',
        // Reader mode: full-bleed on mobile (negative margin to cancel parent p-4), normal padding on larger screens
        shouldApplyReaderMode && '-mx-4 px-4 py-6 sm:mx-0 sm:p-6 md:p-10 lg:p-12',
        className
      )}
    >
      {shouldApplyReaderMode && caseData ? (
        <CaseDocumentView caseData={caseData} />
      ) : (
        children
      )}
    </div>
  );
}

export { ReaderModeWrapper };
