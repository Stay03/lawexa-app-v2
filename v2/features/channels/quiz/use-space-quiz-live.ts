'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getV2Echo } from '@/v2/runtime/realtime/echo';
import { spaceChannelName } from '@/v2/runtime/realtime/protocol';
import { releaseChannel, retainChannel } from '@/v2/runtime/realtime/channel-listeners';
import { relayQuizGameEvents } from './game-bus';
import { channelQuizQueries } from './queries';
import { spaceRoom } from './quiz-room';

/**
 * useSpaceQuizLive — a Space's live quiz events, from the Space's private
 * channel onto the game bus (live quiz in Spaces, Backend 7a007a8c: the same
 * eight events as a channel game, on `spaces.{uuid}`).
 *
 * The Space's channel is shared: the task board listens on it too
 * (`use-task-board-live.ts`). So this subscribes through the same count
 * (`retainChannel`), stops only its own listeners on the way out, and leaves
 * the channel only when nobody else is on it.
 *
 * Mounted by whatever shows a Space's live game: the Space page and a Space
 * chat. A game going live, finishing or being cancelled refreshes the
 * Space's live probe, which its live bar and its chat's quiz cards read.
 */
export function useSpaceQuizLive(spaceUuid: string | null, enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !spaceUuid) return;
    const echo = getV2Echo();
    if (!echo) return;

    const room = spaceRoom(spaceUuid);
    const name = spaceChannelName(spaceUuid);
    const channel = echo.private(name);
    retainChannel(name);
    const stop = relayQuizGameEvents(channel, room, () => {
      void queryClient.invalidateQueries({ queryKey: channelQuizQueries.activeGameOf(room) });
    });

    return () => {
      stop();
      if (releaseChannel(name) === 0) echo.leave(name);
    };
  }, [enabled, spaceUuid, queryClient]);
}
