'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GraduationCap, Loader2, MailWarning, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/hooks/useAuth';
import { useQuizSessions, useStartQuizSession } from '@/lib/hooks/useQuiz';
import { extractApiError } from '@/lib/utils/api-error';
import { formatScorePercent } from '@/lib/utils/quiz-format';
import { QuizTopicChips } from './QuizTopicChips';

/** Quiz entry point: starts a new session, or resumes an open one. */
export function QuizStart() {
  const router = useRouter();
  const { user } = useAuth();
  const startSession = useStartQuizSession();
  const sessionsQuery = useQuizSessions({ per_page: 1 });
  const [topic, setTopic] = useState<string | null>(null);

  // Only email/password signups need to verify; OAuth logins (e.g. Google) are
  // already verified. Mirrors the check-email gate in useAuth. Unknown role/loading
  // is treated as not-blocked so we never flash the notice prematurely.
  const emailUnverified =
    user?.auth_provider === 'email' && user?.is_verified === false;
  const activeSession =
    sessionsQuery.data?.data?.find((s) => s.status === 'active') ?? null;
  const hasHistory = (sessionsQuery.data?.data?.length ?? 0) > 0;

  const handleStart = () => {
    startSession.mutate(
      { topic: topic ?? undefined },
      {
        onSuccess: (response) =>
          router.push(`/quiz/play?s=${response.data.session.uuid}`),
        onError: (error) => {
          const apiError = extractApiError(error);
          if (apiError.status === 403) {
            toast.error('Verify your email first', {
              description: 'Please verify your email to start practising.',
            });
            return;
          }
          toast.error('Could not start a session', {
            description: apiError.message,
          });
        },
      }
    );
  };

  const handleResume = () => {
    if (activeSession) router.push(`/quiz/play?s=${activeSession.uuid}`);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100svh-9rem)] w-full max-w-md flex-col items-center justify-center gap-8 py-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none">
      <div className="space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <GraduationCap className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold">Quiz Mode</h1>
          <p className="text-sm text-muted-foreground">
            Practise with multiple-choice questions drawn from your own study
            conversations.
          </p>
        </div>
      </div>

      {emailUnverified ? (
        <div className="w-full rounded-2xl border bg-card p-5 text-left">
          <div className="flex gap-3">
            <MailWarning className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Verify your email to start</p>
              <p className="text-sm text-muted-foreground">
                Quiz practice needs a verified email. Check your inbox for the
                verification link.
              </p>
            </div>
          </div>
        </div>
      ) : activeSession ? (
        <div className="w-full space-y-3">
          <Button
            size="lg"
            className="h-12 w-full text-base"
            onClick={handleResume}
          >
            <RotateCcw className="h-5 w-5" />
            Resume your session
          </Button>
          <p className="text-xs text-muted-foreground">
            {activeSession.answered_count > 0
              ? `${activeSession.answered_count} answered · ${formatScorePercent(activeSession.score_percentage)}`
              : 'You have an open session in progress.'}
          </p>
        </div>
      ) : (
        <div className="w-full space-y-5">
          <Button
            size="lg"
            className="h-12 w-full text-base"
            onClick={handleStart}
            disabled={startSession.isPending}
          >
            {startSession.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            Start practice
          </Button>
          <div className="text-left">
            <QuizTopicChips selected={topic} onSelect={setTopic} />
          </div>
        </div>
      )}

      {!emailUnverified && hasHistory && (
        <Link
          href="/quiz/history"
          className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          View past sessions →
        </Link>
      )}
    </div>
  );
}
