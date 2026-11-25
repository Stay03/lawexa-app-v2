'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { AgentChainChangedEvent, HeldMessagesAnsweredEvent } from '@/types/agent-chain';
import { releaseChannel, retainChannel } from '@/v2/runtime/realtime/channel-listeners';
import { getV2Echo } from '@/v2/runtime/realtime/echo';
import { EVT_AGENT_CHAIN_CHANGED, EVT_HELD_MESSAGES_ANSWERED, spaceChannelName } from '@/v2/runtime/realtime/protocol';
import { landAgentChainChanged, landHeldMessagesAnswered } from './chain-events';

/**
 * useSpaceChainLive — a Space chat's agents move for every member (chain
 * view, Backend a779b3cc): the server sends each change on the Space's
 * private channel too, which every member may join, so a member who did not
 * ask sees the rows move and the held marks clear as the owner does. Only
 * this chat's events are landed.
 *
 * The owner also gets them on `users.{uuid}` (the spine); landing one twice
 * reads the chain once more. The channel is left only when the last listener
 * on it goes ({@link retainChannel}, as the task board does). No Echo (on the
 * server, or with no Reverb settings) does nothing.
 */
export function useSpaceChainLive(conversationId: string, spaceUuid: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!spaceUuid) return;
    const echo = getV2Echo();
    if (!echo) return;
    const onChanged = (event: AgentChainChangedEvent) => {
      if (event?.conversation_id === conversationId) landAgentChainChanged(queryClient, event);
    };
    const onHeldAnswered = (event: HeldMessagesAnsweredEvent) => {
      if (event?.conversation_id === conversationId) landHeldMessagesAnswered(queryClient, event);
    };
    const name = spaceChannelName(spaceUuid);
    const channel = echo.private(name);
    channel.listen(EVT_AGENT_CHAIN_CHANGED, onChanged);
    channel.listen(EVT_HELD_MESSAGES_ANSWERED, onHeldAnswered);
    retainChannel(name);
    return () => {
      channel.stopListening(EVT_AGENT_CHAIN_CHANGED, onChanged);
      channel.stopListening(EVT_HELD_MESSAGES_ANSWERED, onHeldAnswered);
      if (releaseChannel(name) === 0) echo.leave(name);
    };
  }, [conversationId, spaceUuid, queryClient]);
}
