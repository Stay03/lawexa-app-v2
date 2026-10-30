'use client';

import { use } from 'react';
import { AdminChannelQuizDetail } from '@/components/admin/channel-quiz/AdminChannelQuizDetail';

/** Explore quizzes (new) › one quiz and its questions' numbers. */
export default function AdminExploreQuizPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  return <AdminChannelQuizDetail uuid={uuid} />;
}
