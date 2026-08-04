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
 * NO OPTIMISM HERE, DELIBERATELY. The visible effect of a reset is a new
 * `ai_divider` message, and that message arrives through the presence room like
 * any other — so the honest sequence is: ask, wait, and let the divider land
 * itself. Faking a divider would put a line in the transcript that the server
 * had not agreed to, and a failed reset would then have to un-say it.
 *
 * The session INDEX is invalidated on settle: the active session just became a
 * closed one, and the sheet must not keep calling it live.
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
