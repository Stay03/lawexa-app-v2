'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StatuteDetailSkeleton } from '@/components/statutes';
import { StatuteDocumentHeader, StatuteDocumentRenderer } from '@/components/statutes-v2';
import { PageContainer } from '@/components/layout';
import { FloatingPromptInput } from '@/components/ui/floating-prompt-input';
import { BookmarkButton } from '@/components/common/BookmarkButton';
import { ShareButton } from '@/components/common/ShareButton';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { AddToFolderButton } from '@/components/folders';
import { useStatute } from '@/lib/hooks/useStatutes';

/******************************************************************************
                               Page Component
******************************************************************************/

interface StatuteViewPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}

/**
 * Statute detail page — renders content as a clean legal document (AKN view).
 */
function StatuteViewPage({ params, searchParams }: StatuteViewPageProps) {
  const { slug } = use(params);
  use(searchParams);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useStatute(slug);

  if (isLoading) {
    return (
      <PageContainer variant="detail">
        <StatuteDetailSkeleton />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer variant="detail">
        <ErrorState
          title="Failed to load statute"
          description="We couldn't load this statute. Please try again."
          retry={() => refetch()}
        />
      </PageContainer>
    );
  }

  if (!data?.data) {
    return (
      <PageContainer variant="detail">
        <EmptyState
          icon={BookOpen}
          title="Statute not found"
          description="The statute you're looking for doesn't exist or has been removed."
          action={{ label: 'Browse Statutes', onClick: () => router.push('/statutes') }}
        />
      </PageContainer>
    );
  }

  const statute = data.data;

  return (
    <>
      <PageContainer variant="detail" className="pb-24">
        {/* Actions */}
        <div className="flex items-center gap-2">
          <BookmarkButton
            type="statute"
            id={statute.id}
            isBookmarked={statute.is_bookmarked}
            bookmarksCount={statute.bookmarks_count}
            variant="full"
          />
          <ShareButton />
          <FeedbackButton
            context={{
              contentType: 'statute',
              contentId: statute.id,
              contentTitle: statute.title,
            }}
            variant="full"
          />
          <AddToFolderButton itemType="statute" itemId={statute.id} />
        </div>

        {/* Legal Document Body */}
        <div className="statute-document">
          {/* Document Header */}
          <StatuteDocumentHeader statute={statute} />

          {/* Preamble */}
          {statute.preamble && (
            <div className="preamble">{statute.preamble}</div>
          )}

          {/* Document Content */}
          <StatuteDocumentRenderer slug={slug} />
        </div>
      </PageContainer>

      <FloatingPromptInput
        contextId={slug}
        contextType="statute"
        contextTitle={statute.title}
      />
    </>
  );
}

export default StatuteViewPage;
