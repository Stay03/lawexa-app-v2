'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getV2Echo } from '@/v2/runtime/realtime/echo';
import { EVT_TASK_CHANGED, spaceChannelName, type SpaceTaskChangedEvent } from '@/v2/runtime/realtime/protocol';
import { spacesQueries } from '../../queries';
import { applyTaskChanged } from './task-cache';

/**
 * useTaskBoardLive — the board moves while it is open (the techlead's brief,
 * 29 October 2026: live updates). People and agents move tasks through the
 * same API, and the server sends each change to every member on the space's
 * private channel as `.task.changed` with the whole task (Backend's
 * task-board branch 439e6020). The snapshot is written into the board's cache
 * through {@link applyTaskChanged}, so nothing is read again; the task's
 * history is marked stale, so an open sheet shows the new move.
 *
 * The subscribe and leave follow the realtime spine's (`spine.tsx`): no Echo
 * (on the server, or with no Reverb settings) does nothing, and the board's
 * unmount leaves the channel. The spine owns the connection itself.
 */
export function useTaskBoardLive(spaceUuid: string, viewerId: number | null, enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const echo = getV2Echo();
    if (!echo) return;

    const name = spaceChannelName(spaceUuid);
    const boardKey = spacesQueries.tasks(spaceUuid, { viewerId }).queryKey;
    echo.private(name).listen(EVT_TASK_CHANGED, (event: SpaceTaskChangedEvent) => {
      queryClient.setQueryData(boardKey, (list) => (list ? applyTaskChanged(list, event) : list));
      void queryClient.invalidateQueries({ queryKey: spacesQueries.taskMovesOf(spaceUuid, event.task.uuid) });
    });

    return () => {
      echo.leave(name);
    };
  }, [enabled, spaceUuid, viewerId, queryClient]);
}
