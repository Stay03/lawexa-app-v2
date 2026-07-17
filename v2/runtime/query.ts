import {
  QueryClient,
  MutationCache,
  defaultShouldDehydrateQuery,
  type QueryKey,
  type MutationMeta,
} from '@tanstack/react-query';
import { cache } from 'react';

/**
 * v2 query-layer policy (standards §2, adopted verbatim). This module owns the
 * ONE QueryClient configuration the whole v2 tree runs on: staleTime tiers, the
 * dehydrate-pending config for streaming prefetch, and the global MutationCache
 * that turns every mutation error into a single error-channel callback and every
 * mutation success into meta-declared invalidation.
 *
 * ISOMORPHIC BY DESIGN — this module must stay importable from RSCs (the
 * phase-3+ prefetch path), so it must never import client-only modules
 * (`sonner`, anything `'use client'`). The browser-only toast wiring is
 * injected by `query-provider.tsx` via {@link MakeQueryClientOptions};
 * server-created clients get no handler (mutations never run in RSCs).
 *
 * It is deliberately framework-plumbing only — no feature keys, no UI. Feature
 * modules import {@link STALE_TIMES}/{@link GC_TIMES} and build `queryOptions`
 * factories (see `v2/features/cases/queries.ts` for the exemplar).
 */

/**
 * staleTime tiers — the freshness lever (standards §2). Pick a tier per query;
 * never reach for `refetchOnWindowFocus: false` to paper over staleness, that
 * flag stays ON.
 *
 *  - `live`      0          badges / presence with no socket coverage
 *  - `realtime`  Infinity   Echo-covered data — socket events ARE the signal
 *  - `standard`  60s        the default (also set as the QueryClient default)
 *  - `reference` 10min      statutes / cases lists; pair with `GC_TIMES.reference`
 *  - `static`    'static'   boot constants (plans, countries, flags) — never refetched
 */
export const STALE_TIMES = {
  live: 0,
  realtime: Infinity,
  standard: 60 * 1000,
  reference: 10 * 60 * 1000,
  static: 'static',
} as const;

/**
 * gcTime companions. Only the reference tier overrides the default gcTime — a
 * 30-minute cache window keeps list data (and its scroll position on back-nav)
 * around well past its 10-minute staleTime.
 */
export const GC_TIMES = {
  reference: 30 * 60 * 1000,
} as const;

/**
 * The mutation `meta` contract, typed onto TanStack's `Register` so every
 * `mutation.meta` across v2 is checked (see the module augmentation below).
 *
 *  - `invalidates`  query-key prefixes the global `onSuccess` invalidates after
 *                   the mutation resolves. Each entry is a full query key; an
 *                   entry acts as a prefix (TanStack matches by key prefix).
 *                   Omit `'static'`-tier keys — those never need invalidating.
 *  - `silentError`  opt the mutation out of the global error toast when it
 *                   renders its own inline error UI instead.
 */
export interface V2MutationMeta extends Record<string, unknown> {
  invalidates?: readonly QueryKey[];
  silentError?: boolean;
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: V2MutationMeta;
  }
}

/** Handlers injected by the environment that constructs the client. */
export interface MakeQueryClientOptions {
  /**
   * Called with a readable message when any mutation errors (unless it opted
   * out via `meta.silentError`). The browser provider wires this to the sonner
   * toast; server clients omit it.
   */
  onMutationError?: (message: string, error: unknown) => void;
}

/**
 * Best-effort human-readable message from an unknown mutation error. Handles the
 * axios error shape thrown by the v1 `apiClient` (`error.response.data.message`,
 * the API's own message), then the raw `Error.message`, then a safe fallback.
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      response?: { data?: { message?: unknown } };
      message?: unknown;
    };
    const apiMessage = candidate.response?.data?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      return candidate.message;
    }
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Invalidate every key a mutation declared in `meta.invalidates`. No-op when the
 * mutation declared none. Returns the settling promise so a caller can `await`
 * the global `onSuccess` (TanStack awaits returned promises before the mutation
 * is considered settled).
 */
function invalidateFromMeta(
  queryClient: QueryClient,
  meta: MutationMeta | undefined,
): Promise<void> {
  const invalidates = meta?.invalidates;
  if (!invalidates?.length) return Promise.resolve();
  return Promise.all(
    invalidates.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ).then(() => undefined);
}

/**
 * Build a fully-configured v2 QueryClient. Called once per browser tab (the
 * singleton in `query-provider.tsx`, which injects the toast handler) and once
 * per request on the server — see {@link getServerQueryClient}.
 */
export function makeQueryClient(options?: MakeQueryClientOptions): QueryClient {
  // Declared with a name so the MutationCache callbacks can close over it. The
  // closures only READ `queryClient` when a mutation later settles, long after
  // this `new QueryClient(...)` has assigned it — so the TDZ never bites (this
  // is TanStack's documented global-callback pattern).
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIMES.standard,
        retry: 1,
        // `refetchOnWindowFocus` stays at its ON default (standards §2): the
        // staleTime tier is the freshness lever, never this flag.
      },
      dehydrate: {
        // Also dehydrate still-pending queries so a server prefetch that hasn't
        // resolved streams its promise to the client, which resumes it — the
        // streaming-SSR path phase-3+ RSCs rely on.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
    },
    mutationCache: new MutationCache({
      // ONE error channel for every mutation (standards §2 — structurally kills
      // the silent-rollback bug class). Opt out per-mutation with
      // `meta: { silentError: true }` when rendering inline error UI instead.
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silentError) return;
        options?.onMutationError?.(getErrorMessage(error), error);
      },
      // ONE invalidation channel: a mutation declares what it dirtied via
      // `meta: { invalidates: [key, ...] }` and this fires it — no ad-hoc
      // per-callsite invalidation sprawl.
      onSuccess: (_data, _variables, _context, mutation) =>
        invalidateFromMeta(queryClient, mutation.meta),
    }),
  });

  return queryClient;
}

/**
 * Per-request SERVER client, memoized for the render pass by React `cache()` so
 * every RSC / Server Action / metadata call in one request shares a single
 * client (and thus a single dehydrated cache). This is the accessor phase-3+
 * server components use for `prefetchQuery` + `HydrationBoundary`.
 *
 * The BROWSER client lives in `query-provider.tsx` (it needs the client-only
 * toast handler); client code reaches it via `useQueryClient()`.
 */
export const getServerQueryClient = cache(() => makeQueryClient());
