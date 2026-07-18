import { queryOptions } from '@tanstack/react-query';
import { adminAiApi } from '@/lib/api/admin-ai';
import type { AdminAiWorkflowsParams } from '@/types/admin-ai';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * AI workflows query policy — copies the `v2/features/cases/queries.ts`
 * exemplar exactly: a hierarchical key factory whose leaf is a `queryOptions()`
 * object, wrapping the shared `lib/api/admin-ai.ts` `getWorkflows` fetcher
 * unchanged. This is the source the composer's role-aware workflow selector reads
 * for admin/superadmin (regular users get v1's fixed Lite/Expert list, no fetch).
 *
 * REFERENCE tier (10min) — the workflow catalogue is admin-configured data that
 * changes rarely within a session, so a 10-minute staleTime keeps the selector
 * instant on reopen without going stale for long. `/admin/ai-workflows` requires
 * an admin token, so `enabled` stays a call-site concern
 * (`useQuery({ ...workflowsQueries.list(p), enabled: isAdmin })`) exactly like the
 * exemplar documents.
 */
export const workflowsQueries = {
  all: ['ai-workflows'] as const,

  lists: () => [...workflowsQueries.all, 'list'] as const,

  /** A workflow list variant (params keyed so each shares one cache entry). */
  list: (params: AdminAiWorkflowsParams = {}) =>
    queryOptions({
      queryKey: [...workflowsQueries.lists(), params] as const,
      queryFn: () => adminAiApi.getWorkflows(params),
      staleTime: STALE_TIMES.reference,
    }),
};
