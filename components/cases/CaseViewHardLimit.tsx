import Link from 'next/link';
import { ShieldX, ArrowUpRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CaseViewLimitError } from '@/types/case';

interface CaseViewHardLimitProps {
  limitError: CaseViewLimitError;
  message?: string;
  className?: string;
}

/**
 * Full blocked screen shown when a user hits the hard view limit (429).
 */
function CaseViewHardLimit({
  limitError,
  message,
  className,
}: CaseViewHardLimitProps) {
  const resetsAt = new Date(limitError.resets_at);
  const formattedResetDate = resetsAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center',
        className
      )}
    >
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <ShieldX className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="mb-1 text-lg font-semibold">Monthly View Limit Reached</h3>
      <p className="mb-2 max-w-sm text-sm text-muted-foreground">
        {message || 'You have used all your available case views for this month.'}
      </p>
      <p className="mb-6 text-sm text-muted-foreground">
        Your limit resets on{' '}
        <span className="font-medium text-foreground">{formattedResetDate}</span>.
        <br />
        Views used: {limitError.used} / {limitError.plan_limit}
      </p>
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <Link href="/cases">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Browse Cases
          </Link>
        </Button>
        <Button asChild>
          <Link href="/upgrade">
            Upgrade Plan
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export { CaseViewHardLimit };
