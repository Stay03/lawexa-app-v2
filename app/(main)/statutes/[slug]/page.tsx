'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  StatuteDetailSkeleton,
  StatuteDetailHeader,
  StatuteMetadataGrid,
  StatuteNodeTree,
} from '@/components/statutes';
import { PageContainer } from '@/components/layout';
import { FloatingPromptInput } from '@/components/ui/floating-prompt-input';
import { BookmarkButton } from '@/components/common/BookmarkButton';
import { ShareButton } from '@/components/common/ShareButton';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { AddToFolderButton } from '@/components/folders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStatute } from '@/lib/hooks/useStatutes';

/******************************************************************************
                               Constants
******************************************************************************/

const ANIMATION_DELAYS = {
  header: 0,
  actions: 50,
  preamble: 150,
  metadata: 250,
  nodeTree: 400,
} as const;

/******************************************************************************
                               Components
******************************************************************************/

interface StatuteViewPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}

/**
 * Statute detail view page with animated sections
 */
function StatuteViewPage({ params, searchParams }: StatuteViewPageProps) {
  const { slug } = use(params);
  const { q: searchQuery } = use(searchParams);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useStatute(slug);

  // Loading state
  if (isLoading) {
    return (
      <PageContainer variant="detail">
        <StatuteDetailSkeleton />
      </PageContainer>
    );
  }

  // Error state
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

  // Not found state
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
        {/* Hero Header */}
        <StatuteDetailHeader
          title={statute.title}
          shortTitle={statute.short_title}
          country={statute.country}
          year={statute.year}
          status={statute.status}
          statusLabel={statute.status_label}
          commencementDate={statute.commencement_date}
          nodesCount={statute.nodes_count}
          animationDelay={ANIMATION_DELAYS.header}
        />

        {/* Actions */}
        <div
          className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both flex items-center gap-2 duration-200"
          style={{ animationDelay: `${ANIMATION_DELAYS.actions}ms` }}
        >
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

        {/* Preamble */}
        {statute.preamble && (
          <Card
            className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both border-primary/10"
            style={{ animationDelay: `${ANIMATION_DELAYS.preamble}ms` }}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Preamble</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm italic leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {statute.preamble}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Metadata Grid */}
        <StatuteMetadataGrid
          country={statute.country}
          year={statute.year}
          statusLabel={statute.status_label}
          commencementDate={statute.commencement_date}
          creator={statute.creator}
          nodesCount={statute.nodes_count}
          animationStartDelay={ANIMATION_DELAYS.metadata}
        />

        {/* Node Tree — the hierarchical content */}
        {statute.nodes_count > 0 && (
          <div
            className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both"
            style={{ animationDelay: `${ANIMATION_DELAYS.nodeTree}ms` }}
          >
            <h2 className="mb-4 text-lg font-semibold">Provisions</h2>
            <StatuteNodeTree slug={slug} nodesCount={statute.nodes_count} />
          </div>
        )}
      </PageContainer>
      <FloatingPromptInput
        contextSlug={slug}
        contextType="statute"
        contextTitle={statute.title}
      />
    </>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default StatuteViewPage;
