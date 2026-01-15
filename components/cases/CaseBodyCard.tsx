import { BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CaseBodyCardProps {
  body: string;
  excerpt: string;
  className?: string;
  animationDelay?: number;
}

/**
 * Main content card for case body/summary with HTML rendering
 */
function CaseBodyCard({
  body,
  excerpt,
  className,
  animationDelay = 0,
}: CaseBodyCardProps) {
  const hasBody = body && body.trim().length > 0;

  return (
    <Card
      className={cn(
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4" />
          Case Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {hasBody ? (
            <div
              dangerouslySetInnerHTML={{ __html: body }}
              className="whitespace-pre-wrap"
            />
          ) : (
            <p className="text-muted-foreground">{excerpt}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { CaseBodyCard };
