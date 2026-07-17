'use client';

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { toast } from 'sonner';
import { makeQueryClient } from './query';

/**
 * Browser-side owner of the v2 QueryClient. This is the ONLY place the
 * client-only toast handler is wired into the query layer — `query.ts` stays
 * isomorphic (safe to import from RSCs for prefetch) precisely because sonner
 * lives here, behind the `'use client'` boundary, and is injected via
 * `MakeQueryClientOptions`.
 */

let browserQueryClient: QueryClient | undefined;

function getClientForProvider(): QueryClient {
  if (typeof window === 'undefined') {
    // SSR pass of this client component: a fresh, handler-less client per
    // render (never a module singleton — that would leak across requests).
    // RSC prefetching does NOT use this path; it uses `getServerQueryClient`.
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient({
    // ONE error channel for every v2 mutation (standards §2).
    onMutationError: (message) => toast.error(message),
  });
  return browserQueryClient;
}

/**
 * Mounts the v2 QueryClient for the `app/v2/` subtree. Rendered inside the v2
 * layout, which is itself nested inside the root layout's v1 `<QueryProvider>`.
 *
 * NESTING NOTE: `QueryClientProvider` writes the client into React context, and
 * `useQueryClient()` reads the NEAREST provider. So for anything rendered under
 * this provider the v2 client shadows the root v1 client — v2 gets the v2 policy
 * (tiers, global MutationCache) while every v1 page outside `app/v2/` keeps
 * using the root client untouched. Two clients, two caches, cleanly isolated by
 * context depth — no changes to `providers/QueryProvider.tsx` required.
 *
 * Uses the module-level singleton accessor, NOT `useState`: Next can discard
 * component state during a suspended initial render, which would rebuild the
 * client and drop the cache; the module-level singleton survives that.
 */
export function V2QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getClientForProvider();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Bound to the v2 client — on v2 routes the root devtools (v1 client)
          shows nothing, this one shows the queries that actually ran. Dev-only;
          tree-shaken from production. */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
