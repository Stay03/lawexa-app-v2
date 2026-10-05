'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  useMutation,
  useMutationState,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';

import { notificationsApi } from '@/lib/api/notifications';
import { warmChannelHistory } from '@/v2/features/channels/warm';
import { useV2Session } from '@/v2/runtime/session-context';
import type {
  DeleteNotificationResponse,
  MarkAllReadResponse,
  MarkReadResponse,
  Notification,
  ShowNotificationResponse,
  UnreadCountResponse,
} from '@/types/notification';
import {
  adjustUnreadCount,
  applyReinsertRow,
  applyRemoveRow,
  applyRevertAllRead,
  applyRevertRead,
  applyStampAllRead,
  applyStampRead,
  wasUnreadInAnyList,
  zeroUnreadCount,
  type StreamReadUndo,
  type StreamRemoval,
  type StreamSnapshot,
} from './cache';
import {
  notificationChannelUuid,
  notificationMessageUuid,
  presentNotification,
} from './presentation';
import { notificationsQueries } from './queries';

/**
 * notification mutations — every write the bell and `/notifications` make,
 * shared, so a press on either surface settles both. The cache writes
 * themselves are pure and live in `cache.ts`; this file decides WHEN they run
 * and what is asked of the server afterwards.
 *
 * ── WHAT EACH WRITE RE-ASKS, AND WHAT IT DELIBERATELY DOES NOT ────────────
 *  - MARK ONE READ re-asks the COUNT only, once the last of a burst settles.
 *    The rows are not refetched: the optimistic stamp differs from the
 *    server's by milliseconds, `POST /notifications/{id}/read` is idempotent,
 *    and invalidating the lists would refetch every loaded page of every
 *    stream for one click. Arrival, focus and the realtime spine reconcile
 *    them later.
 *  - MARK ALL re-asks the lists and the count. One press, rare, and a Read
 *    stream needs the server's order.
 *  - DELETE re-asks the count, and stays pending until it has it, so the
 *    row cannot be repainted by anything in between
 *    ({@link useHiddenNotificationIds}).
 *
 * Errors ride the ONE global mutation-error toast; each write rolls back
 * exactly what it changed (see `cache.ts`), and the row coming back is itself
 * the visible answer. Always `mutate`, never `mutateAsync` (standards §2).
 */

/** Optimistic `read_at` stamp. Module-level (not a component or hook) so the
 *  `new Date()` is outside render; it only ever runs inside `onMutate`. */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * The resolver's cached row follows the lists, so a second visit to the same
 * `/notifications/{id}` does not mark it read again. `when` guards the write:
 * a stamp lands only on an unread row, and a rollback clears only our stamp.
 */
function stampDetail(
  queryClient: QueryClient,
  id: string,
  readAt: string | null,
  when: (current: string | null) => boolean,
): void {
  queryClient.setQueryData<ShowNotificationResponse>(
    notificationsQueries.detail(id).queryKey,
    (data) =>
      data && when(data.data.read_at)
        ? { ...data, data: { ...data.data, read_at: readAt } }
        : data,
  );
}

/* ── Mark one read ────────────────────────────────────────────────────────── */

export const MARK_READ_MUTATION_KEY = ['notifications', 'mark-read'] as const;

interface MarkReadContext {
  readAt: string;
  undos: readonly StreamReadUndo[];
  /** Whether the badge was lowered, so a rollback raises it by exactly that. */
  decremented: boolean;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation<MarkReadResponse, Error, string, MarkReadContext>({
    mutationKey: MARK_READ_MUTATION_KEY,
    mutationFn: (id) => notificationsApi.markAsRead(id),
    onMutate: async (id) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: notificationsQueries.lists() }),
        queryClient.cancelQueries({ queryKey: notificationsQueries.unreadCount().queryKey }),
      ]);
      const readAt = nowIso();
      // Read BEFORE stamping: afterwards the row is read everywhere.
      const decremented = wasUnreadInAnyList(queryClient, id);
      const undos = applyStampRead(queryClient, id, readAt);
      if (decremented) {
        queryClient.setQueryData<UnreadCountResponse>(
          notificationsQueries.unreadCount().queryKey,
          (previous) => adjustUnreadCount(previous, -1),
        );
      }
      stampDetail(queryClient, id, readAt, (current) => current === null);
      return { readAt, undos, decremented };
    },
    onError: (_error, id, context) => {
      if (!context) return;
      applyRevertRead(queryClient, context.undos);
      if (context.decremented) {
        queryClient.setQueryData<UnreadCountResponse>(
          notificationsQueries.unreadCount().queryKey,
          (previous) => adjustUnreadCount(previous, 1),
        );
      }
      stampDetail(queryClient, id, null, (current) => current === context.readAt);
    },
    // Once per BURST: a reader clearing five rows in a row asks for the count
    // once, after the last one, instead of five times.
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: MARK_READ_MUTATION_KEY }) !== 1) return;
      return queryClient.invalidateQueries({
        queryKey: notificationsQueries.unreadCount().queryKey,
      });
    },
  });
}

/* ── Mark all read ────────────────────────────────────────────────────────── */

interface MarkAllContext {
  readAt: string;
  snapshots: readonly StreamSnapshot[];
  previousCount: UnreadCountResponse | undefined;
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation<MarkAllReadResponse, Error, void, MarkAllContext>({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onMutate: async () => {
      const countKey = notificationsQueries.unreadCount().queryKey;
      await Promise.all([
        queryClient.cancelQueries({ queryKey: notificationsQueries.lists() }),
        queryClient.cancelQueries({ queryKey: countKey }),
      ]);
      const readAt = nowIso();
      const previousCount = queryClient.getQueryData<UnreadCountResponse>(countKey);
      queryClient.setQueryData<UnreadCountResponse>(countKey, zeroUnreadCount);
      const snapshots = applyStampAllRead(queryClient, readAt);
      return { readAt, snapshots, previousCount };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        applyRevertAllRead(queryClient, context.readAt, context.snapshots);
        queryClient.setQueryData<UnreadCountResponse>(
          notificationsQueries.unreadCount().queryKey,
          context.previousCount,
        );
      }
      // The server is the only party that knows which rows a half-failed
      // mark-all reached, so it is asked.
      void queryClient.invalidateQueries({ queryKey: notificationsQueries.lists() });
      void queryClient.invalidateQueries({
        queryKey: notificationsQueries.unreadCount().queryKey,
      });
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: notificationsQueries.lists() }),
        queryClient.invalidateQueries({
          queryKey: notificationsQueries.unreadCount().queryKey,
        }),
      ]),
  });
}

/* ── Delete ───────────────────────────────────────────────────────────────── */

/** The key every DELETE is registered under, so the in-flight set is one
 *  declarative filter. */
export const DELETE_NOTIFICATION_MUTATION_KEY = ['notifications', 'delete'] as const;

/** The id rides the VARIABLES, not a closure, because that is what
 *  `useMutationState` can read back (the folders and invitations contract). */
interface DeleteNotificationVariables {
  id: string;
}

interface DeleteContext {
  removals: readonly StreamRemoval[];
  decremented: boolean;
}

/**
 * The raw delete. Screens press {@link useDeleteNotificationWithUndo}; this is
 * the write it eventually performs.
 */
function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation<
    DeleteNotificationResponse,
    Error,
    DeleteNotificationVariables,
    DeleteContext
  >({
    mutationKey: DELETE_NOTIFICATION_MUTATION_KEY,
    mutationFn: ({ id }) => notificationsApi.delete(id),
    // NO `scope`: it would queue deletes of DIFFERENT rows behind each other.
    // Two deletes of one row cannot race, because the first hides the row.
    onMutate: async ({ id }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: notificationsQueries.lists() }),
        queryClient.cancelQueries({ queryKey: notificationsQueries.unreadCount().queryKey }),
      ]);
      const decremented = wasUnreadInAnyList(queryClient, id);
      const removals = applyRemoveRow(queryClient, id);
      if (decremented) {
        queryClient.setQueryData<UnreadCountResponse>(
          notificationsQueries.unreadCount().queryKey,
          (previous) => adjustUnreadCount(previous, -1),
        );
      }
      return { removals, decremented };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      applyReinsertRow(queryClient, context.removals);
      if (context.decremented) {
        queryClient.setQueryData<UnreadCountResponse>(
          notificationsQueries.unreadCount().queryKey,
          (previous) => adjustUnreadCount(previous, 1),
        );
      }
    },
    onSuccess: (_result, { id }) => {
      queryClient.removeQueries({ queryKey: notificationsQueries.detail(id).queryKey });
      // RETURNED, NOT VOIDED: TanStack holds the mutation `pending` until this
      // settles, which is the window `useHiddenNotificationIds` keeps the row
      // unpaintable for (`invitations/mutations.ts` explains the mechanism).
      return queryClient.invalidateQueries({
        queryKey: notificationsQueries.unreadCount().queryKey,
      });
    },
  });
}

/* ── The undo window ──────────────────────────────────────────────────────── */

/**
 * ── A DEFERRED SEND, BECAUSE THERE IS NO RESTORE ──────────────────────────
 * The API cannot restore a deleted notification (`notification-api.md`: "No
 * way to restore deleted notifications"), so an Undo offered AFTER the DELETE
 * could only put the row back in the cache while it stayed deleted on the
 * server, and the next refetch would take it away again. That toast would lie.
 *
 * So the window comes BEFORE the request, the mechanism
 * `folders/folder-mutations.ts` built for the same problem and documents in
 * full: the press hides the row and starts a timer, Undo cancels a request that
 * has not been made, and the DELETE goes out when the window closes. A tab
 * closed inside the window leaves the row in place, which is the safe
 * direction. There is no unload flush, for the reasons that file gives.
 *
 * Module scope, not component state: the bell's panel closes and the page
 * unmounts, and a timer owned by either would die with it and the delete would
 * silently never happen.
 */
export const NOTIFICATION_UNDO_WINDOW_MS = 6000;

/** The window in whole seconds, for the copy, so the number the reader is
 *  given can never drift from the timer they are racing. */
const UNDO_WINDOW_SECONDS = Math.round(NOTIFICATION_UNDO_WINDOW_MS / 1000);

/** Frozen empty set, so "nothing scheduled" is one stable reference. */
const NO_IDS: ReadonlySet<string> = new Set<string>();

/** The snapshot `useSyncExternalStore` reads, replaced only when it changes. */
let scheduledIds: ReadonlySet<string> = NO_IDS;

/** id → the timer and the write it will make. */
const scheduled = new Map<string, { timer: ReturnType<typeof setTimeout> }>();

const listeners = new Set<() => void>();

function emit(): void {
  scheduledIds = scheduled.size === 0 ? NO_IDS : new Set(scheduled.keys());
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): ReadonlySet<string> {
  return scheduledIds;
}

function getServerSnapshot(): ReadonlySet<string> {
  return NO_IDS;
}

function scheduleDelete(id: string, commit: () => void): void {
  const existing = scheduled.get(id);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    // COMMIT FIRST, then leave the queue: the mutation is `pending` from inside
    // `commit()`, so the in-flight half of the hidden set is already true
    // before the queued half turns false and the row cannot flash back.
    commit();
    scheduled.delete(id);
    emit();
  }, NOTIFICATION_UNDO_WINDOW_MS);
  scheduled.set(id, { timer });
  emit();
}

/** `false` means the DELETE had already gone out. */
function cancelDelete(id: string): boolean {
  const entry = scheduled.get(id);
  if (!entry) return false;
  clearTimeout(entry.timer);
  scheduled.delete(id);
  emit();
  return true;
}

/** Narrow `useMutationState`'s `unknown` variables to a delete's id. */
function deleteTargetId(variables: unknown): string | null {
  if (typeof variables !== 'object' || variables === null) return null;
  const candidate = variables as Partial<DeleteNotificationVariables>;
  return typeof candidate.id === 'string' && candidate.id ? candidate.id : null;
}

/**
 * Every row a list must NOT paint: queued for delete, or with its DELETE in
 * flight. Both halves are needed; `useHiddenFolderUuids` explains why the
 * second one is not defensive noise. A FAILED delete leaves both, so the row
 * comes back, which is the truth.
 */
export function useHiddenNotificationIds(): ReadonlySet<string> {
  const queued = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const inFlight = useMutationState({
    filters: { mutationKey: DELETE_NOTIFICATION_MUTATION_KEY, status: 'pending' },
    select: (mutation) => deleteTargetId(mutation.state.variables),
  });

  return useMemo(() => {
    const sending = inFlight.filter((id): id is string => id !== null);
    if (queued.size === 0 && sending.length === 0) return NO_IDS;
    return new Set([...queued, ...sending]);
  }, [queued, inFlight]);
}

export interface DeleteWithUndoOptions {
  /** Runs after a successful Undo. The inbox uses it to put focus back on
   *  the restored row. */
  onUndo?: () => void;
}

/**
 * Delete a notification with a real undo. Returns a stable callback. The row
 * leaves in the same frame (it joins the hidden set), the toast holds the
 * window open, and the write goes out when the window closes.
 */
export function useDeleteNotificationWithUndo(): (
  notification: Notification,
  options?: DeleteWithUndoOptions,
) => void {
  const send = useDeleteNotification().mutate;

  return useCallback(
    (notification: Notification, options?: DeleteWithUndoOptions) => {
      const { id } = notification;
      const toastId = `notification-delete-${id}`;

      scheduleDelete(id, () => {
        // Dismissed BY the commit, not by a duration: sonner pauses its own
        // timer on hover and while the window is unfocused, so without this an
        // Undo button could outlive the request it claims to stop.
        toast.dismiss(toastId);
        send({ id });
      });

      // FUTURE TENSE: for the next six seconds nothing has been sent.
      toast('Notification will be removed', {
        id: toastId,
        description: `${UNDO_WINDOW_SECONDS} seconds to undo.`,
        duration: NOTIFICATION_UNDO_WINDOW_MS,
        action: {
          label: 'Undo',
          onClick: () => {
            if (cancelDelete(id)) {
              toast.success('Notification kept', { description: 'Nothing was sent.' });
              options?.onUndo?.();
            } else {
              // Unreachable while the commit dismisses this toast; kept because
              // the alternative is claiming a recovery that did not happen.
              toast.error('That notification has already been removed');
            }
          },
        },
      });
    },
    [send],
  );
}

/* ── Opening a row ────────────────────────────────────────────────────────── */

/**
 * What pressing a row does BEFORE its link is followed, on both surfaces: it
 * settles the row (mark read, if unread), and for a row that points into a
 * channel it warms the transcript one beat before the navigation lands.
 *
 * WHY WARM HERE: the spine already warms on the socket event, which covers a
 * session that was running when the message arrived. This covers the case it
 * cannot — the app opened cold from a push, where no event was ever received
 * and this press is the first the client hears of the channel. `force`,
 * because a row someone has just pressed is not a candidate to be throttled.
 *
 * Navigation itself is the row's own element (a `<Link>`, an `<a>` or nothing),
 * so this never routes.
 */
export function useActivateNotification(): (notification: Notification) => void {
  const queryClient = useQueryClient();
  // The transcript cache is partitioned by viewer.
  const viewerId = useV2Session().userId;
  const markRead = useMarkNotificationRead().mutate;

  return useCallback(
    (notification: Notification) => {
      if (!notification.read_at) markRead(notification.id);
      if (presentNotification(notification).destination.kind !== 'internal') return;
      const channelUuid = notificationChannelUuid(notification);
      if (!channelUuid) return;
      warmChannelHistory(queryClient, {
        channelUuid,
        messageUuid: notificationMessageUuid(notification),
        viewerId,
        force: true,
      });
    },
    [markRead, queryClient, viewerId],
  );
}
