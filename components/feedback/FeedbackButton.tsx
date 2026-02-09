'use client';

import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { FeedbackDialog } from './FeedbackDialog';
import type { FeedbackContext } from '@/types/feedback';

/******************************************************************************
                               Types
******************************************************************************/

interface FeedbackButtonProps {
  context: FeedbackContext;
  /** 'icon' = icon-only (for cards), 'full' = icon + label (for detail pages) */
  variant?: 'icon' | 'full';
  className?: string;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Reusable feedback button that opens the FeedbackDialog.
 */
function FeedbackButton({
  context,
  variant = 'icon',
  className,
}: FeedbackButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (variant === 'full') {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className={cn('gap-1.5', className)}
        >
          <MessageSquarePlus className="h-4 w-4" />
          Feedback
        </Button>
        <FeedbackDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          context={context}
        />
      </>
    );
  }

  // Icon-only variant
  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDialogOpen(true)}
              className={cn('h-8 w-8', className)}
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span className="sr-only">Give feedback</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Give feedback</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <FeedbackDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        context={context}
      />
    </>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export { FeedbackButton };
