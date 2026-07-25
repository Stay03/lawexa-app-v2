'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { getCaseDisplayTitle } from '@/lib/utils/case-title';
import { extractViewLimitError } from '@/lib/utils/api-error';
import { useV2Session } from '@/v2/runtime/session-context';
import { clearHeaderContext, setHeaderContext } from '@/v2/shell/header-context';
import { casesQueries } from '../queries';
import { CaseAsk } from './CaseAsk';
import { CaseDocument } from './CaseDocument';
import {
  CASE_COLUMN,
  CaseDocumentSkeleton,
  CaseErrorState,
  CaseHardLimitState,
  CaseNotFoundState,
} from './states';

/**
 * CaseScreen — the `/cases/[slug]` client root.
 *
 * The server shell above it owns `generateMetadata` (title, canonical, the OG
 * card) so a pasted link unfurls correctly; this owns everything a reader sees.
 * They read the SAME case from two different places on purpose: the metadata
 * fetch is unauthenticated and shared-cached because a crawler is not signed in,
 * while this one carries the reader's session and therefore their bookmark state
 * and their plan's view allowance. Merging them would mean either caching a
 * per-user response across users or emitting metadata only signed-in readers can
 * see — both wrong.
 */
export function CaseScreen({ slug }: { slug: string }) {
  return (
    // `useSearchParams` (the `?q=` read-attribution parameter) requires a
    // boundary; the fallback is the document skeleton at the real geometry.
    <Suspense fallback={<CaseFallback />}>
      <CaseBody slug={slug} />
    </Suspense>
  );
}

function CaseBody({ slug }: { slug: string }) {
  const { signedIn, userId, role } = useV2Session();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q')?.trim() || undefined;

  const query = useQuery(casesQueries.detail(slug, searchQuery));
  const detail = query.data?.data ?? null;
  const title = detail ? getCaseDisplayTitle(detail) : null;

  // Publish the header title once it resolves, and clear it on the way out so
  // the next route never inherits this case's name. An external-store write, not
  // React state — which is what makes it legal in an effect under the React
  // Compiler lint.
  useEffect(() => {
    if (!title) return;
    setHeaderContext({ title, confidential: false });
  }, [title]);
  useEffect(() => () => clearHeaderContext(), []);

  if (query.isPending) {
    return (
      <div className={CASE_COLUMN}>
        <CaseDocumentSkeleton />
      </div>
    );
  }

  if (query.isError) {
    // A 429 is not a failure to load — it is the plan's monthly allowance, and it
    // deserves its own screen with the numbers and the reset date on it.
    const limit = extractViewLimitError(query.error);
    return (
      <div className={CASE_COLUMN}>
        {limit ? (
          <CaseHardLimitState limit={limit} />
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

  return (
    <div className={CASE_COLUMN}>
      {/* `.v2-case-doc` scopes the reading typography (case-document.css) over
          BOTH the judgment and the ask cluster, so their headings match. */}
      <div className="v2-case-doc flex flex-col gap-10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        <CaseDocument detail={detail} />
        <CaseAsk
          slug={slug}
          title={title ?? detail.title}
          signedIn={signedIn}
          viewerId={userId}
          role={role}
        />
      </div>
    </div>
  );
}

/** The Suspense fallback — identical to `app/v2/cases/[slug]/loading.tsx`. */
export function CaseFallback() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading case
      </span>
      <div aria-hidden inert className={CASE_COLUMN}>
        <CaseDocumentSkeleton still />
      </div>
    </>
  );
}
