import { queryOptions, type QueryClient } from '@tanstack/react-query';

import { userBoxApi } from '@/lib/api/user-box';
import type { UserBoxControlEvent, UserBoxStatus } from '@/types/user-box';

/**
 * Lawexa's machine, read (Userbox v1). The read issues a fresh view token,
 * and the server logs each one, so it runs only while the panel is open and
 * is read again on each open (`refetchOnMount: 'always'`) and just before the
 * token lapses (`use-machine.ts`). `retry: false` and no toast: the panel
 * says what went wrong where it stands.
 */
export const userBoxQueries = {
  all: ['user-box'] as const,

  status: ({ viewerId }: { viewerId: number | null }) =>
    queryOptions({
      queryKey: [...userBoxQueries.all, { viewerId }] as const,
      queryFn: async () => {
        const answer = await userBoxApi.get();
        if (!answer.data) throw new Error(answer.message || 'Lawexa’s machine did not load.');
        return answer.data;
      },
      staleTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      retry: false,
      meta: { silentError: true },
    }),
};

/**
 * A write's answer into the read: wake, sleep and take-over answer without the
 * view, so the view the read holds is kept.
 */
export function landUserBox(queryClient: QueryClient, next: Partial<UserBoxStatus>) {
  queryClient.setQueriesData<UserBoxStatus>({ queryKey: userBoxQueries.all }, (current) =>
    current ? { ...current, ...next, view: next.view ?? current.view } : current,
  );
}

/** The `users.{uuid}` → `.userbox.control` broadcast, into the read. */
export function landUserBoxControl(queryClient: QueryClient, event: UserBoxControlEvent) {
  landUserBox(queryClient, {
    control: event.control,
    control_reason: event.reason,
    hand_over_message: event.control === 'user' ? event.message : null,
  });
}

/**
 * The live view's own `{type:'mode'}` message, into the read: it can come
 * before the broadcast. A hand-over keeps its reason and request; a person
 * who simply acted drives for `user_acted`.
 */
export function landUserBoxMode(queryClient: QueryClient, mode: 'lawexa' | 'user') {
  queryClient.setQueriesData<UserBoxStatus>({ queryKey: userBoxQueries.all }, (current) => {
    if (!current || current.control === mode) return current;
    return mode === 'lawexa'
      ? { ...current, control: 'lawexa', control_reason: null, hand_over_message: null }
      : { ...current, control: 'user', control_reason: current.control_reason ?? 'user_acted' };
  });
}
