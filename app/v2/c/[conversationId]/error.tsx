'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';

import { reportChatError } from '@/v2/runtime/chat-errors/report';
import V2Error from '../../error';

/**
 * The chat screen's error boundary: the v2 one, plus a report of the crash
 * (`chat-errors/report.ts`), since the server never sees one. Only the error's
 * name and digest go, never its message, which could quote the chat.
 */
export default function ConversationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ conversationId?: string }>();
  const conversationId = params?.conversationId ?? null;

  useEffect(() => {
    reportChatError({
      code: 'chat_view_crash',
      message: `The chat screen crashed: ${error.name}${error.digest ? ` (digest ${error.digest})` : ''}.`,
      conversationId,
    });
  }, [error, conversationId]);

  return <V2Error error={error} reset={reset} />;
}
