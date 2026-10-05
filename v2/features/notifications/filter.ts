import type { NotificationReadFilter } from './queries';

/**
 * The inbox filter — which rows `/notifications` shows, read from `?read=`.
 *
 * TWO TABS, All and Unread. v1 also had Read, and it answered a question nobody
 * brings to an inbox ("what have I already seen, on its own?"): All covers it,
 * so the tab was dropped (tech lead, 2026-10-05). The API filter still exists,
 * so bringing the tab back is one entry in {@link NOTIFICATION_FILTERS} and one
 * case in {@link parseReadFilter}.
 *
 * THE v1 PARAM NAME IS KEPT, so a v1 link such as `/notifications?read=unread`
 * means the same thing here. `?read=read` from v1 lands on All, the view that
 * contains those rows, rather than on an error.
 */
export type NotificationFilter = 'all' | 'unread';

export const NOTIFICATION_FILTERS: readonly {
  id: NotificationFilter;
  label: string;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
];

/** Read the tab out of `?read=`. Anything but `unread` is All. */
export function parseReadFilter(raw: string | null): NotificationFilter {
  return raw === 'unread' ? 'unread' : 'all';
}

/** The API filter a tab asks for; All asks for none. */
export function apiReadFilter(
  filter: NotificationFilter,
): NotificationReadFilter | undefined {
  return filter === 'unread' ? 'unread' : undefined;
}

/** The `?read=` value a tab writes; All writes none, so `/notifications` is
 *  the plain address of the unfiltered view. */
export function readParam(filter: NotificationFilter): string | null {
  return filter === 'unread' ? 'unread' : null;
}
