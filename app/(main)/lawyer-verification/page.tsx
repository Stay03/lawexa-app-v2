'use client';

import { PageContainer, PageHeader } from '@/components/layout';
import { LawyerGuard } from '@/components/auth/LawyerGuard';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/ErrorState';
import {
  VerificationStatusCard,
  VerificationDocumentsCard,
  VerificationTimelineCard,
} from '@/components/verification';
import { useLawyerProfile } from '@/lib/hooks/useLawyerVerification';

function VerificationPageContent() {
  const { data, isLoading, error, refetch } = useLawyerProfile();

  if (isLoading) {
    return (
      <PageContainer variant="detail">
        <PageHeader
          title="Verification"
          description="Manage your lawyer verification status"
        />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (error || !data?.data) {
    return (
      <PageContainer variant="detail">
        <PageHeader
          title="Verification"
          description="Manage your lawyer verification status"
        />
        <ErrorState
          title="Failed to load verification status"
          description="We couldn't load your verification information. Please try again."
          retry={() => refetch()}
        />
      </PageContainer>
    );
  }

  const profile = data.data;

  return (
    <PageContainer variant="detail">
      <PageHeader
        title="Verification"
        description="Manage your lawyer verification status"
      />
      <div className="space-y-6">
        <VerificationStatusCard profile={profile} />
        <VerificationDocumentsCard profile={profile} />
        <VerificationTimelineCard profile={profile} />
      </div>
    </PageContainer>
  );
}

export default function VerificationPage() {
  return (
    <LawyerGuard>
      <VerificationPageContent />
    </LawyerGuard>
  );
}
