'use client';

import { CheckCircle2, ArrowRight } from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { MultiQuestionProgressInfo } from '@/lib/utils/parse-content-xml';

interface MultiQuestionProgressCardProps {
  progress: MultiQuestionProgressInfo;
}

export function MultiQuestionProgressCard({ progress }: MultiQuestionProgressCardProps) {
  const total = progress.completedIndex + progress.remaining;
  const progressPercent = total > 0 ? Math.round((progress.completedIndex / total) * 100) : 0;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <CheckCircle2 className="size-4 text-primary" />
          Question {progress.completedIndex} of {total} answered
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {progress.nextIndex > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Up next: <span className="font-medium text-foreground">Question {progress.nextIndex}</span>
              {progress.remaining > 1 && (
                <span> &middot; {progress.remaining} remaining</span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
