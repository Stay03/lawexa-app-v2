'use client';

import { use } from 'react';

import { ChannelView } from '@/components/collab/ChannelView';

interface ChannelPageProps {
  params: Promise<{ channelId: string }>;
}

export default function ChannelPage({ params }: ChannelPageProps) {
  const { channelId } = use(params);
  return <ChannelView channelUuid={channelId} />;
}
