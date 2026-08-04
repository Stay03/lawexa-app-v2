'use client';

import { useMemo } from 'react';
import {
  useMutation,
  useMutationState,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { invitationsApi } from '@/lib/api/collab';
import type { LengthAwareResponse } from '@/types/collab';
import { channelsQueries } from '@/v2/features/channels/queries';
import { organizationsQueries } from '@/v2/features/organizations/queries';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { invitationsQueries } from './queries';

/**
 * invitations mutations — accept / decline (organizations say "reject") across
 * the three inboxes, as ONE polymorphic mutation. Sources: plan W4 item 3,
 * `api-digest.md` §C + §F.4 — 2026-08-04.
 *
 * ── THE INTEGER ID IS THE WHOLE TRICK ───────────────────────────────────────
 * The member surface is uuid-only since July 25 — EXCEPT here: every accept /
 * decline / reject path takes **the member row's integer id**
 * (`POST /space-invitations/{memberRowId}/accept`), which is exactly what each
 * inbox row's `id` field carries (digest §F.4). It is NOT the space's,
 * channel's or organization's uuid, and it is NOT the inviter's id. The row
 * shapes (`ChannelInvitation`, `SpaceInvitation`, `OrganizationInvitation`) all
 * expose it as `id: number`, so the screen never has to derive it — it passes
 * the row's own id straight through, and the kind selects the route.
 *
 * ── OPTIMISTIC, BECAUSE ANSWERING AN INVITATION IS A DECISION ───────────────
 * The reader has decided; the row's job is done. So the row leaves the inbox in
 * the same tick as the press (and the pending badge drops with it — the removal
 * decrements `pagination.total`, which is what the badge counts). The rollback
 * is ROW-SCOPED, not a snapshot restore: two invitations answered in quick
 * succession run in parallel, and restoring a whole-response snapshot would
 * resurrect the sibling row that a concurrent removal had already taken out
 * (the `bookmarks/list-cache.ts` lesson, applied).
 *
 * ── A ROW BEING ANSWERED CANNOT BE REPAINTED ────────────────────────────────
 * Accepting invalidates this inbox, the spaces and channels lists, and — for
 * an organization — `/my-organization`. `onSuccess` RETURNS those settling
 * promises rather than voiding them, which is the whole mechanism: TanStack
 * awaits a returned `onSuccess` before dispatching the mutation's `success`
 * state, so the mutation stays `pending` until every cache it dirtied is
 * authoritative. Rows are filtered through
 * {@link usePendingInvitationResponses} for exactly that window, so no refetch
 * — of this inbox or any sibling — can flicker an answered row back.
 *
 * ── ERRORS ─────────────────────────────────────────────────────────────────
 * These fall to the ONE global mutation-error toast (the runtime's channel):
 * the row comes back on rollback, which is itself the visible answer, and the
 * screen raises no toasts of its own.
 */

/** Which inbox a row came from — selects the route family. */
export type InvitationKind = 'organization' | 'space' | 'channel';

/** Accept, or turn it down. Organizations call the second one "reject"; the
 *  vocabulary here stays one word because it is one gesture to the reader. */
export type InvitationAction = 'accept' | 'decline';

/** The variables every response carries. The kind and id live in the
 *  VARIABLES, not only in a hook closure, because that is what makes the
 *  in-flight set readable (`useMutationState` exposes variables, not
 *  closures) — the bookmarks-removal contract. */
export interface InvitationResponseVariables {
  kind: InvitationKind;
  /** The MEMBER ROW's integer id — the path parameter (digest §F.4). */
  id: number;
  action: InvitationAction;
}

/** The key every response is registered under, so the in-flight set is one
 *  declarative filter. */
export const INVITATION_RESPONSE_MUTATION_KEY = ['invitations', 'respond'] as const;

/** Stable identity of one inbox row across the three sections. */
export function invitationRowKey(kind: InvitationKind, id: number): string {
  return `${kind}:${id}`;
}

/** The cache prefix for one inbox, across every viewer partition. */
function inboxPrefix(kind: InvitationKind): QueryKey {
  switch (kind) {
    case 'organization':
      return [...invitationsQueries.all, 'organizations'];
    case 'space':
      return [...invitationsQueries.all, 'spaces'];
    case 'channel':
      return [...invitationsQueries.all, 'channels'];
  }
}

/** Call the right route for a (kind, action) pair. */
function respond({ kind, id, action }: InvitationResponseVariables): Promise<unknown> {
  switch (kind) {
    case 'organization':
      // The organization inbox spells decline "reject" — the only naming
      // divergence in the three families, kept out of the UI vocabulary.
      return action === 'accept'
        ? invitationsApi.organizations.accept(id)
        : invitationsApi.organizations.reject(id);
    case 'space':
      return action === 'accept'
        ? invitationsApi.spaces.accept(id)
        : invitationsApi.spaces.decline(id);
    case 'channel':
      return action === 'accept'
        ? invitationsApi.channels.accept(id)
        : invitationsApi.channels.decline(id);
  }
}

/* ── Row-scoped optimistic removal ────────────────────────────────────────── */

/** One removed row, with everything needed to put it back exactly where it was. */
interface RemovedInvitation {
  queryKey: QueryKey;
  index: number;
  row: { id: number };
}

type InvitationInbox = LengthAwareResponse<{ id: number }>;

/**
 * Drop the row from every cached variant of one inbox and decrement that
 * entry's `pagination.total` — the number the entry badge counts, so the badge
 * falls in the same frame as the row. Returns what was taken, per cache entry,
 * for the row-scoped rollback.
 *
 * Enumerated with `getQueriesData` and written one entry at a time (rather than
 * `setQueriesData` with a shared updater) because the rollback needs each
 * entry's own key, and TanStack's updater signature does not carry it.
 */
function removeInvitationRow(
  queryClient: QueryClient,
  kind: InvitationKind,
  id: number,
): RemovedInvitation[] {
  const removed: RemovedInvitation[] = [];

  for (const [queryKey] of queryClient.getQueriesData<InvitationInbox>({
    queryKey: inboxPrefix(kind),
  })) {
    queryClient.setQueryData<InvitationInbox>(queryKey, (data) => {
      if (!data) return data;
      const index = data.data.findIndex((row) => row.id === id);
      if (index === -1) return data;
      removed.push({ queryKey, index, row: data.data[index] });
      return {
        ...data,
        data: [...data.data.slice(0, index), ...data.data.slice(index + 1)],
        pagination: {
          ...data.pagination,
          total: Math.max(0, data.pagination.total - 1),
        },
      };
    });
  }

  return removed;
}

/** Put the rows back at their old positions — row-scoped, so a sibling row
 *  removed meanwhile is left exactly as it is. */
function reinsertInvitationRow(
  queryClient: QueryClient,
  removed: readonly RemovedInvitation[],
): void {
  for (const entry of removed) {
    queryClient.setQueryData<InvitationInbox>(entry.queryKey, (data) => {
      if (!data) return data;
      if (data.data.some((row) => row.id === entry.row.id)) return data;
      const index = Math.min(entry.index, data.data.length);
      return {
        ...data,
        data: [...data.data.slice(0, index), entry.row, ...data.data.slice(index)],
        pagination: { ...data.pagination, total: data.pagination.total + 1 },
      };
    });
  }
}

/* ── The mutation ─────────────────────────────────────────────────────────── */

/**
 * Answer one invitation. ACCEPTING CREATES A MEMBERSHIP, which changes what
 * every collab list may show — so the spaces and channels list prefixes are
 * invalidated and the newly-joined space/channel is pulled into the caches the
 * reader is about to land on. Declining touches nothing but the inbox.
 */
export function useRespondToInvitation() {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    InvitationResponseVariables,
    { removed: readonly RemovedInvitation[] }
  >({
    mutationKey: INVITATION_RESPONSE_MUTATION_KEY,
    mutationFn: (variables) => respond(variables),
    // NO `scope`, deliberately. TanStack resolves a scope when the mutation is
    // CREATED, and this one hook serves every row on the screen — so any scope
    // string would serialize unrelated invitations behind each other. Answering
    // three rows quickly should send three parallel writes; the double-press
    // case a scope would have covered is already impossible, because the row
    // leaves the list the instant it is answered.
    onMutate: async ({ kind, id }) => {
      await queryClient.cancelQueries({ queryKey: inboxPrefix(kind) });
      return { removed: removeInvitationRow(queryClient, kind, id) };
    },
    onError: (_error, _variables, context) => {
      if (context) reinsertInvitationRow(queryClient, context.removed);
    },
    onSuccess: (_data, { kind, action }) => {
      // RETURNED, NOT VOIDED. TanStack awaits whatever `onSuccess` returns
      // before it dispatches the mutation's `success` state — so returning the
      // settling promises is exactly what holds the mutation `pending` until
      // every cache it dirtied is authoritative. Voiding them closed the
      // pending window early, which is what
      // `usePendingInvitationResponses` uses to keep an answered row
      // unpaintable: a sibling accept's refetch could then land while this
      // row's own inbox refetch was still in flight and flicker it back.
      const invalidations: Promise<unknown>[] = [
        // The inbox re-asserts from the server either way (a declined row is
        // gone server-side; an accepted one has become a membership).
        queryClient.invalidateQueries({ queryKey: inboxPrefix(kind) }),
      ];

      if (action === 'accept') {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: spacesQueries.lists() }),
          queryClient.invalidateQueries({ queryKey: channelsQueries.lists() }),
        );
        // ACCEPTING AN ORGANIZATION INVITATION CHANGES `/my-organization`,
        // which is a DIFFERENT cache family from spaces and channels — and the
        // screen the reader lands on reads exactly that key. Without this the
        // accept navigated to `/organization` and painted the cached "You're
        // not in an organization" panel, which is the port regression v1
        // avoided only because it invalidated its whole `collabKeys.all` tree.
        if (kind === 'organization') {
          invalidations.push(
            queryClient.invalidateQueries({ queryKey: organizationsQueries.all }),
          );
        }
      }

      return Promise.all(invalidations);
    },
  });
}

/** One in-flight answer, narrowed from `useMutationState`'s `unknown`
 *  variables — a real runtime guard, never a hopeful cast. */
interface PendingResponse {
  key: string;
  action: InvitationAction;
}

function pendingResponse(variables: unknown): PendingResponse | null {
  if (typeof variables !== 'object' || variables === null) return null;
  const candidate = variables as Partial<InvitationResponseVariables>;
  if (typeof candidate.id !== 'number') return null;
  if (
    candidate.kind !== 'organization' &&
    candidate.kind !== 'space' &&
    candidate.kind !== 'channel'
  ) {
    return null;
  }
  if (candidate.action !== 'accept' && candidate.action !== 'decline') return null;
  return {
    key: invitationRowKey(candidate.kind, candidate.id),
    action: candidate.action,
  };
}

/** Frozen empty map, so "nothing in flight" is one stable reference. */
const NO_PENDING: ReadonlyMap<string, InvitationAction> = new Map();

/**
 * The rows whose answer is in flight, and WHICH answer — one source for two
 * jobs the screen needs:
 *
 *  1. FILTERING. A row being answered cannot be painted by ANYTHING — not this
 *     inbox's own invalidation refetch, not the spaces refetch that accepting
 *     triggers. TanStack keeps a mutation `pending` until its `onSuccess` (and
 *     the invalidations it returns) have settled, so the window closes at the
 *     first moment the cache is authoritative and not a frame earlier.
 *  2. THE BUSY AFFORDANCE. Which of the two buttons is working, so the spinner
 *     lands on the one that was pressed — visible on a slow connection, where
 *     the row has not left yet.
 *
 * `useMutationState` structurally shares its result, so this returns a stable
 * reference while nothing changes and the memo rebuilds the map only when it
 * truly moves.
 */
export function usePendingInvitationResponses(): ReadonlyMap<string, InvitationAction> {
  const pending = useMutationState({
    filters: { mutationKey: INVITATION_RESPONSE_MUTATION_KEY, status: 'pending' },
    select: (mutation) => pendingResponse(mutation.state.variables),
  });

  return useMemo(() => {
    const entries = pending.filter(
      (entry): entry is PendingResponse => entry !== null,
    );
    if (entries.length === 0) return NO_PENDING;
    return new Map(entries.map((entry) => [entry.key, entry.action]));
  }, [pending]);
}
