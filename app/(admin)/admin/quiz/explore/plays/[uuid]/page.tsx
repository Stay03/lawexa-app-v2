'use client';

import { use } from 'react';
import { AdminChannelQuizPlayDetail } from '@/components/admin/channel-quiz/AdminChannelQuizPlayDetail';

/** Explore quizzes (new) › one play, question by question. */
export default function AdminExplorePlayPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  return <AdminChannelQuizPlayDetail uuid={uuid} />;
}
