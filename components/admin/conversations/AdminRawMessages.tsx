'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/api/admin';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminViewMessage } from '@/types/admin-conversation-view';
import type { ApiMessage } from '@/types/chat';

/**
 * Raw: every message as the server sent it, oldest first, for staff checking
 * what the chat page was given. A tool result over 200 kB arrives cut
 * (`metadata.result_truncated`); Load the full result reads it from its own
 * route.
 */
export function AdminRawMessages({
  conversationId,
  messages,
}: {
  conversationId: string;
  messages: readonly AdminViewMessage[];
}) {
  return (
    <ol data-admin-raw="" className="flex flex-col gap-3">
      {messages.map((message) => (
        <RawMessage key={message.id} conversationId={conversationId} message={message} />
      ))}
    </ol>
  );
}

function RawMessage({ conversationId, message }: { conversationId: string; message: AdminViewMessage }) {
  const [full, setFull] = useState<ApiMessage | null>(null);
  const load = useMutation({
    mutationFn: () => adminApi.getConversationToolResult(conversationId, message.id),
    onSuccess: (response) => setFull(response.data),
    meta: { silentError: true },
  });
  const cut = (message.metadata as { result_truncated?: unknown } | null)?.result_truncated === true && full === null;
  const type = (message.metadata as { type?: unknown } | null)?.type;
  // The full row keeps the staff facts the view added (usage, funding).
  const shown = full ? { ...message, ...full } : message;

  return (
    <li className="min-w-0 rounded-lg border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-xs">
        <span className="font-mono text-muted-foreground">#{message.id}</span>
        <span className="font-medium">{message.role}</span>
        {typeof type === 'string' && <span className="text-muted-foreground">{type}</span>}
        <span className="text-muted-foreground">{message.created_at}</span>
        {cut && (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground">Cut at 200 kB</span>
            <Button variant="outline" size="sm" className="h-7" onClick={() => load.mutate()} disabled={load.isPending}>
              {load.isPending && <Loader2 aria-hidden className="animate-spin" />}
              Load the full result
            </Button>
          </span>
        )}
      </div>
      {load.isError && <p className="px-3 pt-2 text-xs text-destructive">{extractApiError(load.error).message}</p>}
      <pre className="max-h-96 overflow-auto px-3 py-2 text-[11px] leading-relaxed break-words whitespace-pre-wrap">
        {JSON.stringify(shown, null, 2)}
      </pre>
    </li>
  );
}
