'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { channelAiApi } from '@/lib/api/collab';
import { noteThrottled } from '../engagement-throttle';
import { channelsQueries } from '../queries';

/**
 * lawexa/mutations — channel AI session control. Phase-5 W3; sources: plan W3
 * item 7, api-digest §C (`POST /channels/{uuid}/ai/reset` — 10/min, idempotent
 * 200, posts an `ai_divider`) — 2026-08-04.
 *
 * RESET IS THE ONLY WRITE. Everything else about Lawexa in a channel is either
 * a message (the composer's `@lawexa`) or a read.
 *
 * NO OPTIMISM HERE, DELIBERATELY. The server's `ai_divider` message is no
 * longer drawn in the feed — its gold pill read as the unread line, so the feed
 * drops that row (`../feed-model.ts`) — which leaves the SESSION LIST as the
 * one place a reset shows: the active session becomes a closed one, and a fresh
 * active session appears with the next summon. So the honest sequence is
 * unchanged: ask, wait, and let the server's own state say it happened.
 * Anticipating that state would claim a reset the server had not agreed to, and
 * a failed reset would then have to un-say it.
 *
 * The session INDEX is therefore invalidated on settle — it is both the
 * confirmation and the correctness fix, since the sheet must not keep calling a
 * closed session live.
 *
 * FAILURE STAYS ON THIS SCREEN (`meta.silentError`, the W2 house rule). The
 * endpoint is 10/min — tight enough that a double-pressed confirm can trip it —
 * so a 429 registers as a quiet cooldown on the `ai-reset` family and the
 * footer says so in one line beside the button; any other failure is mirrored
 * inline in the same place. Nothing about a reset is worth a global toast.
 */
export function useResetChannelAi(channelUuid: string) {
  const queryClient = useQueryClient();

  return useMutation<Awaited<ReturnType<typeof channelAiApi.reset>>, Error, void>({
    mutationFn: () => channelAiApi.reset(channelUuid),
    meta: { silentError: true },

    onError: (error) => {
      noteThrottled('ai-reset', error);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: channelsQueries.aiSessionsOf(channelUuid),
      });
    },
  });
}
