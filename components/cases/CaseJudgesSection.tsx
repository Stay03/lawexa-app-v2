import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Judge } from '@/types/case';

interface CaseJudgesSectionProps {
  judges: Judge[];
  className?: string;
  animationDelay?: number;
}

/**
 * Dedicated section for displaying presiding judges horizontally
 */
function CaseJudgesSection({
  judges,
  className,
  animationDelay = 0,
}: CaseJudgesSectionProps) {
  // Filter valid judges with string names
  const validJudges = judges.filter(
    (j) => j && typeof j === 'object' && typeof j.name === 'string'
  );

  // Don't render if no valid judges
  if (validJudges.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg bg-muted/30 p-4',
        'animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide mb-2">
        <User className="h-3.5 w-3.5" />
        <span>Presiding {validJudges.length === 1 ? 'Judge' : 'Judges'}</span>
      </div>
      <p className="text-sm font-medium">
        {validJudges.map((judge) => judge.name).join(' • ')}
      </p>
    </div>
  );
}

export { CaseJudgesSection };
