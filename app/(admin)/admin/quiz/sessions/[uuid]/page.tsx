'use client';

import { use } from 'react';
import { AdminQuizSessionDetail } from '@/components/admin/quiz/AdminQuizSessionDetail';

interface AdminQuizSessionPageProps {
  params: Promise<{ uuid: string }>;
}

export default function AdminQuizSessionPage({
  params,
}: AdminQuizSessionPageProps) {
  const { uuid } = use(params);
  return <AdminQuizSessionDetail uuid={uuid} />;
}
