'use client';

import { useParams } from 'next/navigation';
import { AdminQuizBatchDetail } from '@/components/admin/quiz/AdminQuizBatchDetail';

export default function AdminQuizBatchDetailPage() {
  const params = useParams<{ uuid: string }>();
  return <AdminQuizBatchDetail uuid={params.uuid} />;
}
