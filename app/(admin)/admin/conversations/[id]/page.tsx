'use client';

import { use } from 'react';

import { AdminConversationScreen } from '@/components/admin/conversations/AdminConversationScreen';

/** One chat as its owner saw it, with the staff facts (AdminConversationScreen). */
export default function AdminConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AdminConversationScreen id={id} />;
}
