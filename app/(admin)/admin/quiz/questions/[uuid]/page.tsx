'use client';

import { useParams } from 'next/navigation';
import { AdminQuizQuestionDetail } from '@/components/admin/quiz/AdminQuizQuestionDetail';

export default function AdminQuizQuestionDetailPage() {
  const params = useParams<{ uuid: string }>();
  return <AdminQuizQuestionDetail uuid={params.uuid} />;
}
