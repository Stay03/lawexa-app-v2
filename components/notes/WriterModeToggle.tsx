'use client';

import { useState, useEffect } from 'react';
import { PenLine, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useWriterMode } from '@/lib/hooks/useWriterMode';
import { cn } from '@/lib/utils';

interface WriterModeToggleProps {
  className?: string;
}

/**
 * Toggle button for Writer Mode (distraction-free editing) - displays in note create/edit header
 */
function WriterModeToggle({ className }: WriterModeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { isWriterModeEnabled, toggleWriterMode } = useWriterMode();

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render toggle state until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn('gap-2 rounded-full', className)}
        aria-label="Toggle Writer Mode"
        disabled
      >
        <PenLine className="h-4 w-4" />
        Writer Mode
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isWriterModeEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={toggleWriterMode}
          className={cn(
            'gap-2 rounded-full transition-colors',
            isWriterModeEnabled && 'bg-primary text-primary-foreground',
            className
          )}
          aria-label={isWriterModeEnabled ? 'Exit Writer Mode' : 'Enter Writer Mode'}
        >
          {isWriterModeEnabled ? (
            <>
              <Monitor className="h-4 w-4" />
              Normal Mode
            </>
          ) : (
            <>
              <PenLine className="h-4 w-4" />
              Writer Mode
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isWriterModeEnabled ? 'Exit writer mode' : 'Enter distraction-free writer mode'}
      </TooltipContent>
    </Tooltip>
  );
}

export { WriterModeToggle };
