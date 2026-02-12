'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, User, FileText, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { PageContainer } from '@/components/layout';
import { ContentRequestStatusBadge } from '@/components/content-requests';
import { useContentRequest } from '@/lib/hooks/useContentRequests';
import type { ContentRequest } from '@/types/content-request';

/******************************************************************************
                               Constants
******************************************************************************/

const TYPE_LABELS: Record<string, string> = {
  case: 'Case',
  note: 'Note',
};

/******************************************************************************
                               Components
******************************************************************************/

interface ContentRequestDetailPageProps {
  params: Promise<{ uuid: string }>;
}

/**
 * Default component. Content request detail page.
 */
function ContentRequestDetailPage({ params }: ContentRequestDetailPageProps) {
  const { uuid } = use(params);
  const requestQuery = useContentRequest(uuid);

  // Loading state
  if (requestQuery.isLoading) {
    return (
      <PageContainer variant="detail">
        <ContentRequestDetailSkeleton />
      </PageContainer>
    );
  }

  // Error state
  if (requestQuery.isError) {
    return (
      <PageContainer variant="detail">
        <ErrorState
          title="Failed to load request"
          description="We couldn't load this content request. Please try again."
          retry={() => requestQuery.refetch()}
        />
      </PageContainer>
    );
  }

  // Not found
  if (!requestQuery.data?.data) {
    return (
      <PageContainer variant="detail">
        <EmptyState
          icon={FileText}
          title="Request not found"
          description="This content request doesn't exist or you don't have access to view it."
          action={{ label: 'Back to My Requests', onClick: () => window.location.href = '/content-requests' }}
        />
      </PageContainer>
    );
  }

  const request = requestQuery.data.data;

  return (
    <PageContainer variant="detail">
      {/* Back link */}
      <Link
        href="/content-requests"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Requests
      </Link>

      {/* Main content card */}
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{TYPE_LABELS[request.type] || request.type}</Badge>
            <ContentRequestStatusBadge status={request.status} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{request.title}</h1>
        </div>

        {/* Additional notes */}
        {request.additional_notes && (
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium text-muted-foreground mb-1">Additional Notes</p>
            <p className="text-sm whitespace-pre-line">{request.additional_notes}</p>
          </div>
        )}

        {/* Timeline / metadata */}
        <div className="space-y-3">
          <TimelineItem
            icon={Calendar}
            label="Submitted"
            value={formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
            detail={new Date(request.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />

          {request.status === 'fulfilled' && request.fulfilled_by && (
            <TimelineItem
              icon={User}
              label="Fulfilled by"
              value={request.fulfilled_by.name}
              detail={
                request.fulfilled_at
                  ? formatDistanceToNow(new Date(request.fulfilled_at), { addSuffix: true })
                  : undefined
              }
            />
          )}

          {request.status === 'rejected' && request.rejected_by && (
            <TimelineItem
              icon={User}
              label="Reviewed by"
              value={request.rejected_by.name}
              detail={
                request.rejected_at
                  ? formatDistanceToNow(new Date(request.rejected_at), { addSuffix: true })
                  : undefined
              }
            />
          )}
        </div>

        {/* Fulfilled content link */}
        {request.status === 'fulfilled' && request.created_content && (
          <FulfilledContentSection request={request} />
        )}

        {/* Rejection reason */}
        {request.status === 'rejected' && request.rejection_reason && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-sm font-medium text-destructive mb-1">Rejection Reason</p>
            <p className="text-sm">{request.rejection_reason}</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

/**
 * Timeline item showing an icon, label, and value.
 */
function TimelineItem({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="mt-0.5 rounded-full bg-muted p-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div>
        <span className="text-muted-foreground">{label}:</span>{' '}
        <span className="font-medium">{value}</span>
        {detail && (
          <span className="text-muted-foreground"> &middot; {detail}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Section showing the fulfilled content with a link.
 */
function FulfilledContentSection({ request }: { request: ContentRequest }) {
  const content = request.created_content;
  if (!content) return null;

  const contentLink = getContentLink(request);

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">
        Content Available
      </p>
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        {contentLink ? (
          <Link
            href={contentLink}
            className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            {content.title}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-sm font-medium">{content.title}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for the detail page.
 */
function ContentRequestDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-3/4" />
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-40" />
      </div>
    </div>
  );
}

/******************************************************************************
                               Functions
******************************************************************************/

function getContentLink(request: ContentRequest): string | null {
  if (!request.created_content) return null;
  const content = request.created_content;
  switch (request.created_content_type) {
    case 'case':
      return content.slug ? `/cases/${content.slug}` : null;
    case 'note':
      return content.slug ? `/notes/${content.slug}` : null;
    default:
      return null;
  }
}

/******************************************************************************
                               Export default
******************************************************************************/

export default ContentRequestDetailPage;
