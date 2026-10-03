'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '@/lib/api/chat';
import { conversationsCache } from './cache';
import { conversationsQueries } from './queries';

/**
 * Delete a server-held conversation (`DELETE /conversations/{id}`).
 *
 * Never for a confidential chat: its only copy is on the device, and
 * `deleteConfidential` in the controller owns that path.
 *
 * `silentError`: the dialog shows the API's own reason inline (the server
 * refuses a chat that runs a Radar), so the global error toast stays quiet.
 *
 * `onDeleted` runs BEFORE the caches drop the row, so a list can hold the row
 * for its exit collapse and the open chat can leave the route first.
 */
export function useDeleteConversation({
  onDeleted,
}: {
  onDeleted: (conversationId: string) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => chatApi.deleteConversation(conversationId),
    meta: { silentError: true },
    onSuccess: (_response, conversationId) => {
      onDeleted(conversationId);
      // The same shape-aware writer the confidential delete uses, then a
      // revalidate so every list converges on server truth.
      conversationsCache.remove(queryClient, conversationId);
      void queryClient.invalidateQueries({ queryKey: conversationsQueries.lists() });
      // Every viewer partition's transcript (the prefix stops before the viewer
      // id). Removed rather than invalidated: an invalidate refetches a chat
      // that no longer exists.
      queryClient.removeQueries({
        queryKey: [...conversationsQueries.details(), conversationId],
      });
    },
  });
}

/**
 * Rename a server-held conversation (`PATCH /conversations/{id}`, long-list
 * #12). The stored title comes back and is written into every cached list in
 * place, so the sidebar shows it at once without moving the row; the open
 * chat's header re-reads it through the engine (`onRenamed`).
 *
 * `silentError`: the dialog shows the API's reason inline.
 */
export function useRenameConversation({ onRenamed }: { onRenamed: (title: string) => void }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, title }: { conversationId: string; title: string }) =>
      chatApi.renameConversation(conversationId, title),
    meta: { silentError: true },
    onSuccess: (response, { conversationId, title }) => {
      const stored = response.data?.title ?? title;
      conversationsCache.patch(queryClient, conversationId, { title: stored });
      void queryClient.invalidateQueries({ queryKey: [...conversationsQueries.details(), conversationId] });
      onRenamed(stored);
    },
  });
}
