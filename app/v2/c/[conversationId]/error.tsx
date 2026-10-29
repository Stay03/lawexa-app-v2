'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';

import { reportChatError, sendChatError, type ChatErrorReport } from '@/v2/runtime/chat-errors/report';
import V2Error from '../../error';

/**
 * The chat screen's error boundary: the v2 one, plus a report of the crash
 * (`chat-errors/report.ts`), since the server never sees one. Only the error's
 * name and digest go, never its message, which could quote the chat.
 *
 * On a missing chunk the v2 screen reloads the page once, and awaits this
 * report first (`beforeReload`), so the reload cannot cancel it (the
 * techlead, 30 October 2026). The report gate sends one per chat a minute, so
 * the effect's own call after it is dropped, never doubled.
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

  const report = useMemo<ChatErrorReport>(
    () => ({
      code: 'chat_view_crash',
      message: `The chat screen crashed: ${error.name}${error.digest ? ` (digest ${error.digest})` : ''}.`,
      conversationId,
    }),
    [error, conversationId],
  );

  useEffect(() => {
    reportChatError(report);
  }, [report]);

  const beforeReload = useCallback(() => sendChatError(report), [report]);

  return <V2Error error={error} reset={reset} beforeReload={beforeReload} />;
}
