'use client';

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useStatuteAkn } from '@/lib/hooks/useStatutes';
import { ErrorState } from '@/components/common/ErrorState';
import { AknElementRenderer } from './AknElementRenderer';

interface StatuteDocumentRendererProps {
  slug: string;
}

/**
 * Fetches AKN XML for a statute, parses it with DOMParser,
 * and renders via the recursive AknElementRenderer.
 */
function StatuteDocumentRenderer({ slug }: StatuteDocumentRendererProps) {
  const { data: xmlString, isLoading, isError, error, refetch } = useStatuteAkn(slug);

  const bodyElement = useMemo(() => {
    if (!xmlString) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');
    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) return null;
    // Get the <act> element so we render both <body> and <attachments>
    return doc.querySelector('act') ?? doc.querySelector('body');
  }, [xmlString]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    // The statute endpoints are rate-limited server-side (10/min, 200/hour —
    // only scripted bulk fetching hits them). A 429 deserves honest copy
    // instead of the generic failure message.
    const rateLimited =
      (error as { response?: { status?: number } } | null)?.response?.status ===
      429;
    return (
      <ErrorState
        title={rateLimited ? 'Too many requests' : 'Failed to load statute content'}
        description={
          rateLimited
            ? 'You are opening statutes very quickly. Wait a moment, then try again.'
            : "We couldn't load the content of this statute."
        }
        retry={() => refetch()}
      />
    );
  }

  if (!bodyElement) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No content available for this statute.
      </p>
    );
  }

  return <AknElementRenderer element={bodyElement} />;
}

export { StatuteDocumentRenderer };
