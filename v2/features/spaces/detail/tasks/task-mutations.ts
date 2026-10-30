'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { spaceTasksApi } from '@/lib/api/collab';
import type {
  CreateSpaceTaskPayload,
  ReorderSpaceTasksPayload,
  SpaceTask,
  SpaceTaskWritePayload,
} from '@/types/collab';
import { useV2Session } from '@/v2/runtime/session-context';
import { spacesQueries } from '../../queries';
import { applyReorder, removeTask, upsertTask } from './task-cache';

/**
 * task-mutations — the board's writes (the techlead's brief, 29 October 2026:
 * the task sheet, New task and reorder). Each writes the server's answer into
 * the board's cache entry (`spacesQueries.tasks`, `SpaceTask[]`) the moment it
 * returns, then re-reads the board once it settles: a move can change other
 * rows' positions, and Done keeps only 14 days.
 *
 * Errors: the global `MutationCache.onError` toasts the server's own message
 * (`v2/runtime/query.ts`). The sheet also shows a 422's field errors under
 * each field, from the error it gets back.
 *
 * Reorder alone is optimistic: the Queued column moves at once, and goes back
 * if the server refuses.
 */

function useBoardCache(spaceUuid: string) {
  const queryClient = useQueryClient();
  const { userId: viewerId } = useV2Session();
  const boardKey = spacesQueries.tasks(spaceUuid, { viewerId }).queryKey;
  const write = (update: (list: readonly SpaceTask[]) => SpaceTask[]) => {
    queryClient.setQueryData(boardKey, (list) => (list ? update(list) : list));
  };
  const reread = () => queryClient.invalidateQueries({ queryKey: spacesQueries.tasksOf(spaceUuid) });
  return { queryClient, boardKey, write, reread };
}

export function useCreateTask(spaceUuid: string) {
  const { write, reread } = useBoardCache(spaceUuid);
  return useMutation({
    mutationFn: (payload: CreateSpaceTaskPayload) => spaceTasksApi.create(spaceUuid, payload),
    onSuccess: (response) => write((list) => upsertTask(list, response.data)),
    onSettled: reread,
  });
}

export function useUpdateTask(spaceUuid: string) {
  const { write, reread } = useBoardCache(spaceUuid);
  return useMutation({
    mutationFn: ({ taskUuid, payload }: { taskUuid: string; payload: SpaceTaskWritePayload }) =>
      spaceTasksApi.update(spaceUuid, taskUuid, payload),
    onSuccess: (response) => write((list) => upsertTask(list, response.data)),
    // The board's key is the history's prefix: both are read again.
    onSettled: reread,
  });
}

/**
 * One quick change to a task from the board itself: a card dropped on another
 * column, and later a title renamed on the card (the task box design,
 * 1805492d). Optimistic: `shown` is the card as it should look now
 * (`movedTask`), written into the board at once; an error puts just that
 * task back as it was, and the global toast says the server's message. One
 * at a time per space, as each can move other rows' places; the board is
 * read again when it settles, as the other writes do.
 */
export function usePatchTask(spaceUuid: string) {
  const { queryClient, boardKey, write, reread } = useBoardCache(spaceUuid);
  return useMutation({
    mutationFn: ({ task, payload }: { task: SpaceTask; payload: SpaceTaskWritePayload; shown: SpaceTask }) =>
      spaceTasksApi.update(spaceUuid, task.uuid, payload),
    scope: { id: `space-task-patch:${spaceUuid}` },
    onMutate: async ({ shown }) => {
      await queryClient.cancelQueries({ queryKey: boardKey });
      write((list) => upsertTask(list, shown));
    },
    onSuccess: (response) => write((list) => upsertTask(list, response.data)),
    onError: (_error, { task }) => write((list) => upsertTask(list, task)),
    onSettled: reread,
  });
}

/** Start a thread for a task and link it: the board's copy takes the new thread at once. */
export function useStartTaskThread(spaceUuid: string) {
  const { write, reread } = useBoardCache(spaceUuid);
  return useMutation({
    mutationFn: (taskUuid: string) => spaceTasksApi.startThread(spaceUuid, taskUuid),
    onSuccess: (response) => write((list) => upsertTask(list, response.data)),
    onSettled: reread,
  });
}

export function useDeleteTask(spaceUuid: string) {
  const { write, reread } = useBoardCache(spaceUuid);
  return useMutation({
    mutationFn: (taskUuid: string) => spaceTasksApi.remove(spaceUuid, taskUuid),
    onSuccess: (_response, taskUuid) => write((list) => removeTask(list, taskUuid)),
    onSettled: reread,
  });
}

export function useReorderTasks(spaceUuid: string) {
  const { queryClient, boardKey, write, reread } = useBoardCache(spaceUuid);
  return useMutation({
    mutationFn: (payload: ReorderSpaceTasksPayload) => spaceTasksApi.reorder(spaceUuid, payload),
    // One reorder at a time per space: each one names the whole queue.
    scope: { id: `space-task-reorder:${spaceUuid}` },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: boardKey });
      const previous = queryClient.getQueryData(boardKey);
      write((list) => applyReorder(list, payload));
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context) queryClient.setQueryData(boardKey, context.previous);
    },
    onSettled: reread,
  });
}
