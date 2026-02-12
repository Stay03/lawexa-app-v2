'use client';

import Link from 'next/link';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ContentRequestStatusBadge } from './ContentRequestStatusBadge';
import type { ContentRequest } from '@/types/content-request';

/******************************************************************************
                               Constants
******************************************************************************/

const TYPE_LABELS: Record<string, string> = {
  case: 'Case',
  statute: 'Statute',
  provision: 'Provision',
};

/******************************************************************************
                               Components
******************************************************************************/

interface ContentRequestCardProps {
  request: ContentRequest;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Default component. Renders a content request card in the list.
 */
function ContentRequestCard({ request, className, style }: ContentRequestCardProps) {
  const timeAgo = formatDistanceToNow(new Date(request.created_at), { addSuffix: true });
  const contentLink = getContentLink(request);

  return (
    <Link
      href={`/content-requests/${request.uuid}`}
      className={cn(
        'group flex flex-col gap-2.5',
        'px-5 py-4',
        'transition-colors hover:bg-muted/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        className,
      )}
      style={style}
    >
      {/* Header: Title and chevron */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-medium text-foreground group-hover:text-primary line-clamp-1">
            {request.title}
          </h3>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 transition-all group-hover:text-muted-foreground group-hover:translate-x-0.5" />
      </div>

      {/* Badges and metadata row */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline" className="text-xs">
          {TYPE_LABELS[request.type] || request.type}
        </Badge>
        <ContentRequestStatusBadge status={request.status} />
        <span className="text-xs">{timeAgo}</span>
      </div>

      {/* Additional notes preview */}
      {request.additional_notes && (
        <p className="line-clamp-1 text-sm text-muted-foreground">
          {request.additional_notes}
        </p>
      )}

      {/* Fulfilled content link */}
      {request.status === 'fulfilled' && contentLink && (
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <ExternalLink className="h-3 w-3" />
          <span>Content available: {request.created_content?.title}</span>
        </div>
      )}

      {/* Rejection reason */}
      {request.status === 'rejected' && request.rejection_reason && (
        <p className="line-clamp-1 text-xs text-destructive/80">
          Reason: {request.rejection_reason}
        </p>
      )}
    </Link>
  );
}

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Get the link to fulfilled content based on content type.
 */
function getContentLink(request: ContentRequest): string | null {
  if (request.status !== 'fulfilled' || !request.created_content) return null;
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

export { ContentRequestCard };
