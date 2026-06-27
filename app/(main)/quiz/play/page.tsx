'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QuizPlayer } from '@/components/quiz/QuizPlayer';
import { QuizPlaySkeleton } from '@/components/quiz/QuizPlaySkeleton';

/**
 * Active quiz session. Reads the session uuid from `?s=`; a direct visit with no
 * session param bounces back to the start screen.
 *
 * `useSearchParams` must sit under a Suspense boundary in the App Router.
 */
export default function QuizPlayPage() {
  return (
    <Suspense fallback={<QuizPlaySkeleton />}>
      <QuizPlayLoader />
    </Suspense>
  );
}

function QuizPlayLoader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionUuid = searchParams.get('s');

  useEffect(() => {
    if (!sessionUuid) router.replace('/quiz');
  }, [sessionUuid, router]);

  if (!sessionUuid) {
    return <QuizPlaySkeleton />;
  }

  return <QuizPlayer sessionUuid={sessionUuid} />;
}
