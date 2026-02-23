import Link from 'next/link';
import { Lock, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CaseViewLimitBannerProps {
  limitMessage?: string;
  className?: string;
  animationDelay?: number;
}

/**
 * Upgrade prompt shown in place of case body when the user's plan view limit is exceeded.
 */
function CaseViewLimitBanner({
  limitMessage,
  className,
  animationDelay = 0,
}: CaseViewLimitBannerProps) {
  return (
    <Card
      className={cn(
        'border-dashed border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/10',
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <CardContent className="flex flex-col items-center text-center py-10 px-6">
        <div className="mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 p-4">
          <Lock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Case Summary Unavailable</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          {limitMessage ||
            'You have reached your monthly case view limit. Upgrade your plan to continue reading full case summaries.'}
        </p>
        <Button asChild>
          <Link href="/upgrade">
            Upgrade Plan
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export { CaseViewLimitBanner };
