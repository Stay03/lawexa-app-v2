'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getV2Echo } from '@/v2/runtime/realtime/echo';
import { openQuizGameChannelName } from '@/v2/runtime/realtime/protocol';
import { releaseChannel, retainChannel } from '@/v2/runtime/realtime/channel-listeners';
import { relayQuizGameEvents } from './game-bus';
import { channelQuizQueries } from './queries';
import { gameRoom } from './quiz-room';

/**
 * useOpenQuizLive — an open game's events, from its own private channel onto
 * the game bus (live quiz without a Space, Backend live-quiz-open e9c7ac18:
 * `quiz-games.{uuid}`, the same events as a Space game plus
 * `player_removed`). Anyone who may view the game may join the channel.
 *
 * The channel belongs to this game alone, but it subscribes through the same
 * count as a Space's (`retainChannel`), so a second screen on the same game
 * never tears it down under the first. A game finishing or being cancelled
 * refreshes the Live now list, which a public game leaves at once.
 */
export function useOpenQuizLive(gameUuid: string | null, enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !gameUuid) return;
    const echo = getV2Echo();
    if (!echo) return;

    const name = openQuizGameChannelName(gameUuid);
    const channel = echo.private(name);
    retainChannel(name);
    const stop = relayQuizGameEvents(channel, gameRoom(gameUuid), () => {
      void queryClient.invalidateQueries({ queryKey: channelQuizQueries.liveGames() });
    });

    return () => {
      stop();
      if (releaseChannel(name) === 0) echo.leave(name);
    };
  }, [enabled, gameUuid, queryClient]);
}
