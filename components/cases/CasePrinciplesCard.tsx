import { Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CasePrinciplesCardProps {
  principles: string;
  className?: string;
  animationDelay?: number;
}

/**
 * Featured card for displaying legal principles with gold accent
 */
function CasePrinciplesCard({
  principles,
  className,
  animationDelay = 0,
}: CasePrinciplesCardProps) {
  return (
    <Card
      className={cn(
        'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20',
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
          <Scale className="h-4 w-4" />
          Legal Principles
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {principles}
        </p>
      </CardContent>
    </Card>
  );
}

export { CasePrinciplesCard };
