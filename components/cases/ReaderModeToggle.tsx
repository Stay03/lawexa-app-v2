'use client';

import { useState, useEffect } from 'react';
import { BookOpen, BookOpenCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useReaderMode } from '@/lib/hooks/useReaderMode';
import { cn } from '@/lib/utils';

interface ReaderModeToggleProps {
  className?: string;
}

/**
 * Icon button toggle for Reader Mode - displays in case detail header
 */
function ReaderModeToggle({ className }: ReaderModeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { isReaderModeEnabled, toggleReaderMode } = useReaderMode();

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render toggle state until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn('transition-colors', className)}
        aria-label="Toggle Reader Mode"
        disabled
      >
        <BookOpen className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleReaderMode}
          className={cn(
            'transition-colors',
            isReaderModeEnabled && 'bg-primary/10 text-primary',
            className
          )}
          aria-label={isReaderModeEnabled ? 'Exit Reader Mode' : 'Enter Reader Mode'}
        >
          {isReaderModeEnabled ? (
            <BookOpenCheck className="h-5 w-5" />
          ) : (
            <BookOpen className="h-5 w-5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isReaderModeEnabled ? 'Exit Reader Mode' : 'Enter Reader Mode'}
      </TooltipContent>
    </Tooltip>
  );
}

export { ReaderModeToggle };
