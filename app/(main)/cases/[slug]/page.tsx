'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Scale } from 'lucide-react';
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
} from '@/components/cases';
import { PageContainer } from '@/components/layout';
import { useCaseWithRelated } from '@/lib/hooks/useCases';

/******************************************************************************
                               Constants
******************************************************************************/

const ANIMATION_DELAYS = {
  header: 0,
  viewReportButton: 100,
  principles: 150,
  body: 250,
  metadataStart: 350,
  judges: 550,
  similarCases: 650,
  citedCases: 750,
  citedBy: 850,
} as const;

/******************************************************************************
                               Components
******************************************************************************/

interface CaseViewPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Case detail view page with animated sections
 */
function CaseViewPage({ params }: CaseViewPageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useCaseWithRelated(slug);

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

  return (
    <PageContainer variant="detail">
      <ReaderModeWrapper
        caseData={caseDetail}
        slug={slug}
        similarCases={caseDetail.similar_cases}
        citedCases={caseDetail.cited_cases}
        citedBy={caseDetail.cited_by}
      >
        {/* Hero Header */}
        <CaseDetailHeader
          title={caseDetail.title}
          court={caseDetail.court}
          country={caseDetail.country}
          judgmentDate={caseDetail.judgment_date}
          citation={caseDetail.citation}
          tags={caseDetail.tags}
          viewsCount={caseDetail.views_count}
          animationDelay={ANIMATION_DELAYS.header}
        />

        {/* View Full Report Button */}
        {caseDetail.has_full_report && (
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
        <CaseBodyCard
          body={caseDetail.body}
          excerpt={caseDetail.excerpt}
          animationDelay={ANIMATION_DELAYS.body}
        />

        {/* Metadata Grid */}
        <CaseMetadataGrid
          court={caseDetail.court}
          country={caseDetail.country}
          citation={caseDetail.citation}
          topic={caseDetail.topic}
          course={caseDetail.course}
          judicialPrecedent={caseDetail.judicial_precedent}
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
            cases={caseDetail.similar_cases}
            animationDelay={ANIMATION_DELAYS.similarCases}
          />
        )}

        {/* Cases Cited */}
        {caseDetail.cited_cases && caseDetail.cited_cases.length > 0 && (
          <RelatedCasesSection
            type="cited"
            cases={caseDetail.cited_cases}
            animationDelay={ANIMATION_DELAYS.citedCases}
          />
        )}

        {/* Cited By */}
        {caseDetail.cited_by && caseDetail.cited_by.length > 0 && (
          <RelatedCasesSection
            type="cited_by"
            cases={caseDetail.cited_by}
            animationDelay={ANIMATION_DELAYS.citedBy}
          />
        )}
      </ReaderModeWrapper>
    </PageContainer>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default CaseViewPage;
