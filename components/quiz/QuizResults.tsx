'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuizResults } from '@/lib/hooks/useQuiz';
import { extractApiError } from '@/lib/utils/api-error';
import { QuizResultsSummary } from './QuizResultsSummary';
import { QuizResultItemCard } from './QuizResultItemCard';
import { QuizResultsSkeleton } from './QuizResultsSkeleton';
import { QuizMessage } from './QuizMessage';

interface QuizResultsProps {
  sessionUuid: string;
}

export function QuizResults({ sessionUuid }: QuizResultsProps) {
  const router = useRouter();
  const resultsQuery = useQuizResults(sessionUuid);

  const errorStatus = resultsQuery.error
    ? extractApiError(resultsQuery.error).status
    : null;

  // 409 = the session is still active → send them back to keep playing.
  useEffect(() => {
    if (errorStatus === 409) {
      router.replace(`/quiz/play?s=${sessionUuid}`);
    }
  }, [errorStatus, sessionUuid, router]);

  if (resultsQuery.isLoading || errorStatus === 409) {
    return <QuizResultsSkeleton />;
  }

  if (resultsQuery.isError || !resultsQuery.data) {
    return (
      <QuizMessage
        icon={<AlertCircle className="h-7 w-7" />}
        title="We couldn't load these results"
        description={
          resultsQuery.error
            ? extractApiError(resultsQuery.error).message
            : 'Please try again.'
        }
        action={<Button onClick={() => resultsQuery.refetch()}>Try again</Button>}
      />
    );
  }

  const { session, questions } = resultsQuery.data.data;
  const avgTimeMs =
    questions.length > 0
      ? questions.reduce((sum, q) => sum + (q.time_spent_ms || 0), 0) /
        questions.length
      : 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-8">
      <QuizResultsSummary session={session} avgTimeMs={avgTimeMs} />
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Review
        </h2>
        {questions.map((item, index) => (
          <QuizResultItemCard
            key={`${item.sequence}-${index}`}
            item={item}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
