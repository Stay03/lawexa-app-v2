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
  CaseHistorySection,
  CasePartiesSection,
  CaseCounselSection,
  CaseStatutesSection,
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
  parties: 50,
  actions: 100,
  viewReportButton: 150,
  principles: 200,
  body: 300,
  metadataStart: 400,
  judges: 600,
  counsel: 650,
  /* 700 was the arguments section, which this page no longer draws.
     The gap is left so the surrounding delays keep their rhythm. */
  history: 750,
  statutes: 800,
  similarCases: 850,
  citedCases: 900,
  citedBy: 1000,
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
          tags={caseDetail.tags}
          viewsCount={caseDetail.views_count}
          isVerified={caseDetail.is_verified ?? false}
          animationDelay={ANIMATION_DELAYS.header}
        />

        {/* Who the cover names. The title carries two names and a report can
            name a dozen more, so a reader looking for a party has nowhere else
            on the page to look. */}
        {caseDetail.parties && caseDetail.parties.length > 0 && (
          <CasePartiesSection
            parties={caseDetail.parties}
            numbered={caseDetail.parties_numbered}
            animationDelay={ANIMATION_DELAYS.parties}
          />
        )}

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
          topic={caseDetail.topic}
          course={caseDetail.course}
          reportPublishedDate={caseDetail.report_published_date}
          animationStartDelay={ANIMATION_DELAYS.metadataStart}
        />

        {/* Judges Section */}
        <CaseJudgesSection
          judges={caseDetail.judges}
          animationDelay={ANIMATION_DELAYS.judges}
        />

        {/* The lawyers who appeared, the printed line first */}
        {caseDetail.counsel && caseDetail.counsel.length > 0 && (
          <CaseCounselSection
            counsel={caseDetail.counsel}
            animationDelay={ANIMATION_DELAYS.counsel}
          />
        )}

        {/* ── ARGUMENTS ARE DELIBERATELY NOT DRAWN HERE ──────────────────
            Owner's decision, 8 September 2026: "dont add the argument to case
            page, Arthur prefers that so we go with that now". They are
            reviewed in the admin instead, at /admin/cases/argument-review.

            THE COMPONENT IS KEPT AND NOT DELETED because it is correct and the
            preference may change; deleting working code because a preference
            might change is how the preference changing costs a day.

            IT WAS NOT SAFE TO LEAVE RENDERING. It filters `reviewed === true`,
            and on the day it was removed not one argument in the system had
            ever been reviewed — 0 of 4,964 — so it drew nothing and LOOKED
            like the decision was already satisfied. The first approval on the
            new review screen would have put arguments on this page. A guard
            that only holds while a table is empty is not a guard.

            The payload still carries `arguments`; this page chooses not to
            draw them. */}

        {/* How the case got here. Both of these fields have been arriving on
            every payload and nothing rendered either of them. */}
        {caseDetail.court_history && caseDetail.court_history.length > 0 && (
          <CaseHistorySection
            steps={caseDetail.court_history}
            animationDelay={ANIMATION_DELAYS.history}
          />
        )}

        {/* Statutes, rules and books referred to */}
        {caseDetail.statutes_cited && caseDetail.statutes_cited.length > 0 && (
          <CaseStatutesSection
            statutes={caseDetail.statutes_cited}
            animationDelay={ANIMATION_DELAYS.statutes}
          />
        )}

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
