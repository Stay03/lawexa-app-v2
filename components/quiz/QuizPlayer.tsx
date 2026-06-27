'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useEndQuizSession,
  useQuizSession,
  useSubmitQuizAnswer,
} from '@/lib/hooks/useQuiz';
import { extractApiError } from '@/lib/utils/api-error';
import { QuizProgressHeader } from './QuizProgressHeader';
import { QuizQuestionCard } from './QuizQuestionCard';
import { QuizColdStart } from './QuizColdStart';
import { QuizPlaySkeleton } from './QuizPlaySkeleton';
import { QuizMessage } from './QuizMessage';

interface QuizPlayerProps {
  sessionUuid: string;
}

/** A selection is tied to the sequence it belongs to, so it auto-clears when the
 *  next question arrives — no effect needed to reset it. */
interface Selection {
  sequence: number;
  optionId: number;
}

export function QuizPlayer({ sessionUuid }: QuizPlayerProps) {
  const router = useRouter();
  const sessionQuery = useQuizSession(sessionUuid);
  const submitAnswer = useSubmitQuizAnswer(sessionUuid);
  const endSession = useEndQuizSession(sessionUuid);
  const [selection, setSelection] = useState<Selection | null>(null);

  const data = sessionQuery.data?.data;
  const session = data?.session;
  const served = data?.question ?? null;

  const handleEnd = () => {
    endSession.mutate(undefined, {
      onSuccess: () => router.push(`/quiz/${sessionUuid}/results`),
      onError: (error) => {
        toast.error('Could not end the session', {
          description: extractApiError(error).message,
        });
      },
    });
  };

  const handleSelect = (optionId: number) => {
    if (!served || submitAnswer.isPending) return;
    setSelection({ sequence: served.sequence, optionId });
    submitAnswer.mutate(
      { option_id: optionId },
      {
        onError: (error) => {
          setSelection(null);
          const apiError = extractApiError(error);
          // Session ended underneath us → take them to results.
          if (apiError.status === 409) {
            toast.message('This session has ended', {
              description: 'Taking you to your results.',
            });
            router.push(`/quiz/${sessionUuid}/results`);
            return;
          }
          // 422 = stale/duplicate option; the current question is unchanged.
          toast.error('Could not record your answer', {
            description: apiError.message,
          });
        },
      }
    );
  };

  if (sessionQuery.isLoading) {
    return <QuizPlaySkeleton />;
  }

  if (sessionQuery.isError || !session) {
    return (
      <QuizMessage
        icon={<AlertCircle className="h-7 w-7" />}
        title="We couldn't load this session"
        description="Something went wrong fetching your quiz. Please try again."
        action={<Button onClick={() => sessionQuery.refetch()}>Try again</Button>}
      />
    );
  }

  // Resumed a session that has already ended / auto-expired.
  if (session.status !== 'active') {
    return (
      <QuizMessage
        title="This session has ended"
        description="Review how you did, or start a fresh practice session."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/quiz/${sessionUuid}/results`}>View results</Link>
            </Button>
            <Button asChild>
              <Link href="/quiz">Start new</Link>
            </Button>
          </div>
        }
      />
    );
  }

  // Active session but no question to serve → empty bank (cold start).
  if (!served) {
    return <QuizColdStart />;
  }

  const question = served.question;
  const selectedId =
    selection?.sequence === served.sequence ? selection.optionId : null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <QuizProgressHeader
        sequence={served.sequence}
        difficulty={question.difficulty}
        difficultyLabel={question.difficulty_label}
        session={session}
        onEnd={handleEnd}
        ending={endSession.isPending}
      />
      {/* Keyed by sequence so each new question remounts and slides in. */}
      <div
        key={served.sequence}
        className="pt-6 animate-in fade-in slide-in-from-right-6 duration-300 motion-reduce:animate-none"
      >
        <QuizQuestionCard
          question={question}
          selectedId={selectedId}
          pending={submitAnswer.isPending}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
