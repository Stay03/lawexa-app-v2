'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { Channel } from '@/types/collab';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import { canMakeTaskFrom, taskSeedFromThread } from './task-box-model';
import { TaskBox, type TaskBoxTarget } from './TaskBox';

/**
 * "Make a task" from a thread (Stay, 31 October 2026, a284e4fe; plan
 * 4e14d2d4): whether the thread offers it, and the New task box it opens,
 * over the thread's own page, with the thread in its Thread field and the
 * thread's title as the task's. The Space's details are the frame's own read
 * (`CollabFrame`), so the page asks for nothing new.
 */
export function useMakeTaskFromThread(channel: Channel | undefined): { offered: boolean; open: () => void; box: React.ReactNode } {
  const { userId: viewerId } = useV2Session();
  const spaceUuid = channel?.space.uuid ?? '';
  const space = useQuery({ ...spacesQueries.detail(spaceUuid, { viewerId }), enabled: channel?.is_thread === true });
  const offered = channel ? canMakeTaskFrom(channel, space.data?.data) : false;
  const [target, setTarget] = useState<TaskBoxTarget | null>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const box = useMemo(
    () =>
      offered ? (
        <TaskBox
          spaceUuid={spaceUuid}
          // New task reads no board: the box's list serves saved tasks only.
          tasks={NO_TASKS}
          target={target}
          open={open}
          onOpenChange={setOpen}
          canEdit
          rooms
          now={now}
        />
      ) : null,
    [offered, spaceUuid, target, open, now],
  );
  return {
    offered,
    open: () => {
      if (!channel) return;
      setTarget({ kind: 'new', seed: taskSeedFromThread(channel) });
      setNow(Date.now());
      setOpen(true);
    },
    box,
  };
}

const NO_TASKS: readonly never[] = [];
