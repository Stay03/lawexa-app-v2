'use client';

import { useParams } from 'next/navigation';
import { AdminQuizQuestionForm } from '@/components/admin/quiz/AdminQuizQuestionForm';

export default function AdminQuizQuestionEditPage() {
  const params = useParams<{ uuid: string }>();
  return <AdminQuizQuestionForm uuid={params.uuid} />;
}
