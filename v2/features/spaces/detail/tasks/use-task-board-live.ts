'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getV2Echo } from '@/v2/runtime/realtime/echo';
import { EVT_TASK_CHANGED, spaceChannelName, type SpaceTaskChangedEvent } from '@/v2/runtime/realtime/protocol';
import { spacesQueries } from '../../queries';
import { applyTaskChanged } from './task-cache';
import { releaseChannel, retainChannel } from './channel-listeners';

/**
 * useTaskBoardLive — the board moves while it is open (the techlead's brief,
 * 29 October 2026: live updates). People and agents move tasks through the
 * same API, and the server sends each change to every member on the space's
 * private channel as `.task.changed` with the whole task (Backend's
 * task-board branch). The snapshot is written into the board's cache through
 * {@link applyTaskChanged}, so nothing is read again; the task's history is
 * marked stale, so an open sheet shows the new move.
 *
 * The uuids seen deleted are kept while the board is open, so a late
 * `updated` cannot bring a deleted task back (the techlead's review).
 *
 * Unmount stops THIS listener (`stopListening`), and the channel is left
 * only when the last board listening on it goes (the techlead's recheck, 29
 * October 2026): leaving at once would drop another board's listener, and
 * never leaving would keep every Space visited subscribed all session.
 * {@link retainChannel} and {@link releaseChannel} count them.
 * No Echo (on the server, or with no Reverb settings) does nothing. The spine
 * owns the connection itself.
 */
export function useTaskBoardLive(spaceUuid: string, viewerId: number | null, enabled: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const echo = getV2Echo();
    if (!echo) return;

    const boardKey = spacesQueries.tasks(spaceUuid, { viewerId }).queryKey;
    const deleted = new Set<string>();
    const onChanged = (event: SpaceTaskChangedEvent) => {
      // A task some members may not see: no task in the event, so the board
      // reads its own list again, which the server filters per person (Stay's
      // B). A read already out is cancelled for the new one, so only the
      // last read of a burst writes the board.
      if (event.action === 'refresh') {
        void queryClient.invalidateQueries({ queryKey: spacesQueries.tasksOf(spaceUuid) });
        return;
      }
      if (event.action === 'deleted') deleted.add(event.task.uuid);
      queryClient.setQueryData(boardKey, (list) => (list ? applyTaskChanged(list, event, deleted) : list));
      void queryClient.invalidateQueries({ queryKey: spacesQueries.taskMovesOf(spaceUuid, event.task.uuid) });
    };
    const name = spaceChannelName(spaceUuid);
    const channel = echo.private(name);
    channel.listen(EVT_TASK_CHANGED, onChanged);
    retainChannel(name);

    return () => {
      channel.stopListening(EVT_TASK_CHANGED, onChanged);
      if (releaseChannel(name) === 0) echo.leave(name);
    };
  }, [enabled, spaceUuid, viewerId, queryClient]);
}

