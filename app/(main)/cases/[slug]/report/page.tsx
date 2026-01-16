'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Scale, ArrowLeft } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  CaseReportSkeleton,
  FullReportDocumentView,
} from '@/components/cases';
import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { useCaseWithFullReport } from '@/lib/hooks/useCases';

/******************************************************************************
                               Constants
******************************************************************************/

const ANIMATION_DELAYS = {
  backButton: 0,
  document: 100,
} as const;

/******************************************************************************
                               Types
******************************************************************************/

interface ICaseReportPageProps {
  params: Promise<{ slug: string }>;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Full case report page - renders in reader mode by default
 */
function CaseReportPage({ params }: ICaseReportPageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useCaseWithFullReport(slug);

  // Loading state
  if (isLoading) {
    return (
      <PageContainer variant="detail">
        <CaseReportSkeleton />
      </PageContainer>
    );
  }

  // Error state
  if (isError) {
    return (
      <PageContainer variant="detail">
        <ErrorState
          title="Failed to load report"
          description="We couldn't load this case report. Please try again."
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

  // No full report available
  if (!caseDetail.full_report) {
    return (
      <PageContainer variant="detail">
        <EmptyState
          icon={Scale}
          title="No full report available"
          description="This case doesn't have a full report yet."
          action={{ label: 'View Case Summary', onClick: () => router.push(`/cases/${slug}`) }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="detail">
      {/* Back Navigation */}
      <div
        className="animate-in fade-in-0 slide-in-from-left-2 duration-200 fill-mode-both"
        style={{ animationDelay: `${ANIMATION_DELAYS.backButton}ms` }}
      >
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/cases/${slug}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Case
          </Link>
        </Button>
      </div>

      {/* Full Report Document View - always in reader mode styling */}
      <div
        data-reader-mode="true"
        className="reader-mode-transition -mx-4 px-4 py-6 sm:mx-0 sm:p-6 md:p-10 lg:p-12 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both"
        style={{ animationDelay: `${ANIMATION_DELAYS.document}ms` }}
      >
        <FullReportDocumentView caseData={caseDetail} fullReport={caseDetail.full_report} />
      </div>
    </PageContainer>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default CaseReportPage;
