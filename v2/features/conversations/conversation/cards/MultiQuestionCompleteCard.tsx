'use client';

import { CheckCircle2 } from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { MultiQuestionCompleteInfo } from '@/lib/utils/parse-content-xml';

interface MultiQuestionCompleteCardProps {
  info: MultiQuestionCompleteInfo;
}

export function MultiQuestionCompleteCard({ info }: MultiQuestionCompleteCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium text-primary">
          <CheckCircle2 className="size-4" />
          All {info.totalAnswered} questions answered
        </CardTitle>
      </CardHeader>

      {info.summary && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{info.summary}</p>
        </CardContent>
      )}
    </Card>
  );
}
