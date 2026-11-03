'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { userBoxApi } from '@/lib/api/user-box';
import { extractApiError } from '@/lib/utils/api-error';
import type { UserBoxDoneResult } from '@/types/user-box';
import { useV2Session } from '@/v2/runtime/session-context';
import { machineControl, machinePhase, viewRefreshIn, type MachineInputs } from './machine-model';
import { landUserBox, landUserBoxMode, userBoxQueries } from './queries';

/**
 * use-machine — Lawexa's machine for the open panel: its state, the wake that
 * opening the panel asks for, Take over and Done (Userbox v1).
 *
 * OPENING WAKES IT (Stay, 3 November 2026): once the read says the machines
 * are on and this one is not awake, the wake is asked for once. A wake the
 * server refuses (every machine in use) leaves a Wake button and says why.
 *
 * THE VIEW ADDRESS IS READ AGAIN two minutes before its token lapses, so a
 * live view that drops reconnects with a token that still holds.
 *
 * DONE gives the machine back; when a chat was waiting the server starts its
 * next turn, and `onResumed` follows it in that chat.
 */

/** The server's reason for a refusal (`{errors: {reason}}`), when it sent one. */
function reasonOf(error: unknown): string | null {
  const errors = extractApiError(error).errors as unknown;
  if (errors && typeof errors === 'object' && typeof (errors as { reason?: unknown }).reason === 'string') {
    return (errors as { reason: string }).reason;
  }
  return null;
}

export function useMachine({ onResumed }: { onResumed: (result: UserBoxDoneResult) => void }) {
  const session = useV2Session();
  const queryClient = useQueryClient();
  const read = useQuery(userBoxQueries.status({ viewerId: session.userId }));

  const wake = useMutation({
    mutationFn: userBoxApi.wake,
    onSuccess: (answer) => {
      if (answer.data) landUserBox(queryClient, { ...answer.data, state: 'awake' });
    },
    meta: { silentError: true },
  });
  const takeOver = useMutation({
    mutationFn: userBoxApi.takeOver,
    onSuccess: (answer) => {
      if (answer.data) landUserBox(queryClient, answer.data);
    },
    onError: (error) => toast.error(extractApiError(error).message || 'You could not take the machine. Try again.'),
    meta: { silentError: true },
  });
  const done = useMutation({
    mutationFn: userBoxApi.done,
    onSuccess: (answer) => {
      landUserBox(queryClient, { control: 'lawexa', control_reason: null, hand_over_message: null });
      if (answer.data?.resumed) onResumed(answer.data);
    },
    onError: (error) =>
      toast.error(
        reasonOf(error) === 'busy'
          ? 'Lawexa is still answering in that chat. Press Done again when it has finished.'
          : extractApiError(error).message || 'Done did not go through. Try again.',
      ),
    meta: { silentError: true },
  });

  const box = read.data ?? null;
  const readState: MachineInputs['read'] = read.isPending
    ? { status: 'pending' }
    : read.isError || !box
      ? { status: 'error', httpStatus: extractApiError(read.error).status, message: extractApiError(read.error).message }
      : { status: 'ok', box };
  const wakeState: MachineInputs['wake'] = wake.isPending
    ? { status: 'pending' }
    : wake.isError
      ? { status: 'error', httpStatus: extractApiError(wake.error).status, reason: reasonOf(wake.error), message: extractApiError(wake.error).message }
      : wake.isSuccess
        ? { status: 'done' }
        : { status: 'idle' };
  const phase = machinePhase({ read: readState, wake: wakeState });

  // Opening the panel wakes the machine, once.
  const wantsWake = box !== null && box.enabled && box.state !== 'awake' && wake.isIdle;
  const askWake = wake.mutate;
  useEffect(() => {
    if (wantsWake) askWake();
  }, [wantsWake, askWake]);

  // A fresh view address before the token lapses.
  const expiresAt = box?.view?.expires_at ?? null;
  const refetch = read.refetch;
  useEffect(() => {
    const wait = viewRefreshIn(expiresAt, Date.now());
    if (wait === null) return;
    const timer = setTimeout(() => void refetch(), wait);
    return () => clearTimeout(timer);
  }, [expiresAt, refetch]);

  return {
    phase,
    box,
    control: box ? machineControl(box) : null,
    viewUrl: box?.view?.url ?? null,
    /** The live view says who drives now. */
    noteMode: (mode: 'lawexa' | 'user') => landUserBoxMode(queryClient, mode),
    /** Read the state and a fresh view address again (a dropped view, Try again). */
    reread: () => void refetch(),
    wake: () => wake.mutate(),
    takeOver: () => takeOver.mutate(),
    done: () => done.mutate(),
    busy: takeOver.isPending || done.isPending,
  };
}
