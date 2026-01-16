'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/******************************************************************************
                               Types
******************************************************************************/

interface IViewFullReportButtonProps {
  slug: string;
  className?: string;
  /** Button variant - 'solid' for filled green, 'outline' for green outline */
  variant?: 'solid' | 'outline';
  /** Whether the case has a full report - if false, button won't render */
  hasFullReport?: boolean;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Button to navigate to full case report page
 * Returns null if hasFullReport is false
 */
function ViewFullReportButton({
  slug,
  className,
  variant = 'solid',
  hasFullReport = true,
}: IViewFullReportButtonProps) {
  // Don't render if case doesn't have a full report
  if (!hasFullReport) {
    return null;
  }

  return (
    <Button
      asChild
      variant={variant === 'outline' ? 'outline' : 'default'}
      className={cn(
        'gap-2',
        variant === 'solid' && 'bg-green-600 text-white hover:bg-green-700 border-green-600',
        variant === 'outline' &&
          'border-green-600 !text-green-600 hover:bg-green-50 hover:!text-green-700 [&_svg]:text-green-600 hover:[&_svg]:text-green-700',
        className
      )}
    >
      <Link href={`/cases/${slug}/report`}>
        <FileText className="h-4 w-4" />
        View Full Report
      </Link>
    </Button>
  );
}

/******************************************************************************
                               Export
******************************************************************************/

export { ViewFullReportButton };
export type { IViewFullReportButtonProps };
