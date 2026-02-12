import { Badge } from '@/components/ui/badge';
import type { ContentRequestStatus } from '@/types/content-request';

/******************************************************************************
                               Constants
******************************************************************************/

const STATUS_CONFIG: Record<ContentRequestStatus, {
  label: string;
  variant: 'outline' | 'secondary' | 'default' | 'destructive';
  className?: string;
}> = {
  pending: {
    label: 'Pending',
    variant: 'outline',
  },
  in_progress: {
    label: 'In Progress',
    variant: 'secondary',
  },
  fulfilled: {
    label: 'Fulfilled',
    variant: 'default',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
  rejected: {
    label: 'Rejected',
    variant: 'destructive',
  },
};

/******************************************************************************
                               Components
******************************************************************************/

interface ContentRequestStatusBadgeProps {
  status: ContentRequestStatus;
  className?: string;
}

/**
 * Default component. Renders a status badge for a content request.
 */
function ContentRequestStatusBadge({ status, className }: ContentRequestStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={config.className || className}>
      {config.label}
    </Badge>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export { ContentRequestStatusBadge };
