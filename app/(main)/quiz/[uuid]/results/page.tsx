'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { QuizResults } from '@/components/quiz/QuizResults';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';

export default function QuizResultsPage() {
  const params = useParams<{ uuid: string }>();
  const uuid = params.uuid;
  const setOverride = useBreadcrumbStore((s) => s.setOverride);
  const clearOverride = useBreadcrumbStore((s) => s.clearOverride);

  // Relabel the raw uuid crumb → "Session" (Home / Quiz / Session / Results).
  useEffect(() => {
    setOverride(uuid, 'Session');
    return () => clearOverride(uuid);
  }, [uuid, setOverride, clearOverride]);

  return <QuizResults sessionUuid={uuid} />;
}
