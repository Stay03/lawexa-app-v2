'use client';

import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useV2Session } from '@/v2/runtime/session-context';
import { radarsQueries } from './queries';

/**
 * naming.ts — the async AI-naming flow, made VISIBLE.
 *
 * Creating a radar without a name returns an INSTANT fallback name; a backend
 * queue then upgrades it to the AI title. v1 polled for the upgrade (3s cadence
 * inside a 45s window) but showed nothing while it did — the h1 silently
 * changed under the reader. v2 keeps the proven mechanics and adds the honest
 * UI: `useRadarDetail` runs the poll, `useRadarNamePending` tells the screen to
 * render the "Naming this radar…" shimmer, and the screen announces the upgrade
 * through an `aria-live` region when the real name lands.
 *
 * THE MARKER IS CACHE-ONLY. The create mutation seeds a `PendingName` entry
 * (fallback name + wall-clock start); nothing ever fetches it. It survives the
 * navigation from `/radars/new` to the new radar because both screens share the
 * one browser QueryClient, and it is removed the moment the name upgrades or
 * the window lapses — so the poll can never outlive its purpose.
 *
 * ALSO HERE: the first-scan-dispatched flag, the same cache-only trick for a
 * different fact only the create flow knows — whether an immediate first scan
 * was actually dispatched (as opposed to declined or blocked for balance).
 * The detail screen reads it to show the first-scan placeholder row and keep
 * the empty list polling while the queued row is still landing.
 */

const NAME_POLL_MS = 3_000;
const NAME_POLL_WINDOW_MS = 45_000;

/** Retention for the cache-only flags once unobserved — long enough that an
 *  ordinary detour away from the fresh radar and back cannot drop them. */
const CACHE_FLAG_GC_MS = 10 * 60_000;

/** Cache-only marker seeded at create time, read by the detail poll. */
interface PendingName {
  fallback: string;
  since: number;
}

function namePendingKey(radarUuid: string) {
  return [...radarsQueries.all, 'name-pending', radarUuid] as const;
}

function firstScanDispatchedKey(radarUuid: string) {
  return [...radarsQueries.all, 'first-scan-dispatched', radarUuid] as const;
}

/** Seed the naming marker — call from the create mutation's success handler
 *  when the payload carried no name. Event-driven, so the clock read is legal. */
export function markRadarNamePending(
  queryClient: QueryClient,
  radarUuid: string,
  fallbackName: string,
): void {
  queryClient.setQueryData<PendingName>(namePendingKey(radarUuid), {
    fallback: fallbackName,
    since: Date.now(),
  });
}

/** Seed the first-scan flag — same caller, same trick. */
export function markFirstScanDispatched(
  queryClient: QueryClient,
  radarUuid: string,
): void {
  queryClient.setQueryData(firstScanDispatchedKey(radarUuid), true);
}

/** Subscribe to a cache-only flag without ever fetching it. */
function useCacheFlag<T>(queryKey: readonly unknown[]): T | undefined {
  const { data } = useQuery<T>({
    queryKey,
    // Never runs (`enabled: false`); present because the option is required.
    queryFn: () => Promise.reject(new Error('cache-only')),
    enabled: false,
    gcTime: CACHE_FLAG_GC_MS,
    staleTime: Infinity,
  });
  return data;
}

/** True while the freshly created radar is still waiting for its AI name —
 *  drives the shimmer on the detail heading and the header context. */
export function useRadarNamePending(radarUuid: string): boolean {
  return useCacheFlag<PendingName>(namePendingKey(radarUuid)) !== undefined;
}

/** Whether THIS SESSION dispatched an immediate first scan for the radar. */
export function useFirstScanDispatched(radarUuid: string): boolean {
  return useCacheFlag<boolean>(firstScanDispatchedKey(radarUuid)) ?? false;
}

/**
 * The radar detail query with the naming poll layered on: while the pending
 * marker exists, refetch every {@link NAME_POLL_MS} until the name differs
 * from the fallback or the {@link NAME_POLL_WINDOW_MS} window lapses — then
 * remove the marker (which also settles the shimmer) and, on a genuine
 * upgrade, refresh the lists so the new name appears wherever the radar is
 * also listed. v1's exact logic; the interval callback runs outside render,
 * so its clock reads are legal.
 */
export function useRadarDetail(radarUuid: string, enabled = true) {
  const { signedIn, userId: viewerId, role } = useV2Session();
  const queryClient = useQueryClient();
  const authEnabled = signedIn && role !== 'guest';

  return useQuery({
    ...radarsQueries.detail(radarUuid, { viewerId }),
    enabled: authEnabled && enabled && !!radarUuid,
    refetchInterval: (query) => {
      const pending = queryClient.getQueryData<PendingName>(
        namePendingKey(radarUuid),
      );
      if (!pending) return false;

      const currentName = query.state.data?.data.name;
      const upgraded = !!currentName && currentName !== pending.fallback;
      const expired = Date.now() - pending.since > NAME_POLL_WINDOW_MS;

      if (upgraded || expired) {
        queryClient.removeQueries({ queryKey: namePendingKey(radarUuid) });
        if (upgraded) {
          queryClient.invalidateQueries({ queryKey: radarsQueries.lists() });
        }
        return false;
      }
      return NAME_POLL_MS;
    },
    refetchIntervalInBackground: false,
  });
}
