'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Scale } from 'lucide-react';
import { AxiosError } from 'axios';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  CaseDetailSkeleton,
  CaseDetailHeader,
  CasePrinciplesCard,
  CaseBodyCard,
  CaseMetadataGrid,
  CaseJudgesSection,
  ReaderModeWrapper,
  ViewFullReportButton,
  RelatedCasesSection,
  CaseViewThemeSwitcher,
  CaseViewLimitBanner,
  CaseViewHardLimit,
} from '@/components/cases';
import { PageContainer } from '@/components/layout';
import { FloatingPromptInput } from '@/components/ui/floating-prompt-input';
import { BookmarkButton } from '@/components/common/BookmarkButton';
import { ShareButton } from '@/components/common/ShareButton';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { AddToFolderButton } from '@/components/folders';
import { useCaseWithRelated } from '@/lib/hooks/useCases';
import { extractViewLimitError } from '@/lib/utils/api-error';
import { relatedToDisplay, citedEdgeToDisplay } from '@/lib/utils/related-cases';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';

/******************************************************************************
                               Constants
******************************************************************************/

const ANIMATION_DELAYS = {
  header: 0,
  actions: 50,
  viewReportButton: 150,
  principles: 200,
  body: 300,
  metadataStart: 400,
  judges: 600,
  similarCases: 700,
  citedCases: 800,
  citedBy: 900,
} as const;

/******************************************************************************
                               Components
******************************************************************************/

interface CaseViewPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}

/**
 * Case detail view page with animated sections
 */
function CaseViewPage({ params, searchParams }: CaseViewPageProps) {
  const { slug } = use(params);
  const { q: searchQuery } = use(searchParams);
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useCaseWithRelated(slug, searchQuery);

  // Loading state
  if (isLoading) {
    return (
      <PageContainer variant="detail">
        <CaseDetailSkeleton />
      </PageContainer>
    );
  }

  // Error state
  if (isError) {
    const limitError = extractViewLimitError(error);
    if (limitError) {
      return (
        <PageContainer variant="detail">
          <CaseViewHardLimit
            limitError={limitError}
            message={(error as AxiosError<{ message?: string }>)?.response?.data?.message}
          />
        </PageContainer>
      );
    }
    return (
      <PageContainer variant="detail">
        <ErrorState
          title="Failed to load case"
          description="We couldn't load this case. Please try again."
          retry={() => refetch()}
        />
      </PageContainer>
    );
  }

  // Not found state
  if (!data?.data) {
    return (
      <PageContainer variant="detail">
        <EmptyState
          icon={Scale}
          title="Case not found"
          description="The case you're looking for doesn't exist or has been removed."
          action={{ label: 'Browse Cases', onClick: () => router.push('/cases') }}
        />
      </PageContainer>
    );
  }

  const caseDetail = data.data;
  const displayTitle = getCaseDisplayTitle(caseDetail);
  const isLimitExceeded = caseDetail.limit_exceeded === true;

  return (
    <>
      <PageContainer variant="detail" className="pb-24">
        {/* Theme switcher - always visible outside wrapper for superadmin */}
        <div className="flex justify-end mb-2">
          <CaseViewThemeSwitcher />
        </div>
        <ReaderModeWrapper
        caseData={caseDetail}
        slug={slug}
        similarCases={caseDetail.similar_cases}
        citedCases={caseDetail.cited_cases}
        citedBy={caseDetail.cited_by}
      >
        {/* Hero Header */}
        <CaseDetailHeader
          title={displayTitle}
          court={caseDetail.court}
          country={caseDetail.country}
          judgmentDate={caseDetail.judgment_date}
          citation={caseDetail.citation}
          tags={caseDetail.tags}
          viewsCount={caseDetail.views_count}
          animationDelay={ANIMATION_DELAYS.header}
        />

        {/* Actions */}
        <div
          className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex items-center gap-2 duration-200"
          style={{ animationDelay: `${ANIMATION_DELAYS.actions}ms` }}
        >
          <BookmarkButton
            type="case"
            id={caseDetail.id}
            isBookmarked={caseDetail.is_bookmarked}
            bookmarksCount={caseDetail.bookmarks_count}
            variant="full"
          />
          <ShareButton />
          <FeedbackButton
            context={{
              contentType: 'case',
              contentId: caseDetail.id,
              contentTitle: displayTitle,
            }}
            variant="full"
          />
          <AddToFolderButton itemType="case" itemId={caseDetail.id} />
        </div>

        {/* View Full Report Button */}
        {caseDetail.has_full_report && !isLimitExceeded && (
          <div
            className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both"
            style={{ animationDelay: `${ANIMATION_DELAYS.viewReportButton}ms` }}
          >
            <ViewFullReportButton slug={slug} hasFullReport={caseDetail.has_full_report} />
          </div>
        )}

        {/* Legal Principles (Featured) */}
        {caseDetail.principles && (
          <CasePrinciplesCard
            principles={caseDetail.principles}
            animationDelay={ANIMATION_DELAYS.principles}
          />
        )}

        {/* Case Body/Summary */}
        {isLimitExceeded ? (
          <CaseViewLimitBanner
            limitMessage={caseDetail.limit_message}
            animationDelay={ANIMATION_DELAYS.body}
          />
        ) : (
          <CaseBodyCard
            body={caseDetail.body}
            excerpt={caseDetail.excerpt}
            animationDelay={ANIMATION_DELAYS.body}
          />
        )}

        {/* Metadata Grid */}
        <CaseMetadataGrid
          court={caseDetail.court}
          country={caseDetail.country}
          citation={caseDetail.citation}
          topic={caseDetail.topic}
          course={caseDetail.course}
          animationStartDelay={ANIMATION_DELAYS.metadataStart}
        />

        {/* Judges Section */}
        <CaseJudgesSection
          judges={caseDetail.judges}
          animationDelay={ANIMATION_DELAYS.judges}
        />

        {/* Similar Cases */}
        {caseDetail.similar_cases && caseDetail.similar_cases.length > 0 && (
          <RelatedCasesSection
            type="similar"
            cases={caseDetail.similar_cases.map(relatedToDisplay)}
            animationDelay={ANIMATION_DELAYS.similarCases}
          />
        )}

        {/* Cases Cited */}
        {caseDetail.cited_cases && caseDetail.cited_cases.length > 0 && (
          <RelatedCasesSection
            type="cited"
            cases={caseDetail.cited_cases.map(citedEdgeToDisplay)}
            animationDelay={ANIMATION_DELAYS.citedCases}
          />
        )}

        {/* Cited By */}
        {caseDetail.cited_by && caseDetail.cited_by.length > 0 && (
          <RelatedCasesSection
            type="cited_by"
            cases={caseDetail.cited_by.map(relatedToDisplay)}
            animationDelay={ANIMATION_DELAYS.citedBy}
          />
        )}
        </ReaderModeWrapper>
      </PageContainer>
      <FloatingPromptInput
        contextId={slug}
        contextType="case"
        contextTitle={displayTitle}
      />
    </>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default CaseViewPage;
