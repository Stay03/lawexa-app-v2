import { queryOptions } from '@tanstack/react-query';
import { messagePacksApi } from '@/lib/api/message-packs';
import { STALE_TIMES } from '@/v2/runtime/query';
import type { ViewerScoped } from '../queries';

/**
 * The account's AI-message limits (`GET /users/limits`) — the review dialog's
 * "N messages left" line. A v2 query leaf over the shared `lib/api` fetcher
 * (the v1 `useUserLimits` hook is boundary-blocked).
 *
 * VIEWER-SCOPED like every other authed leaf: the balance is per-account
 * data, and an unscoped key could show the previous account's count for a
 * staleTime window after a switch in the same tab.
 *
 * Declared here because the radar create flow is currently its ONLY v2
 * consumer; the key root is feature-neutral (`['user-limits']`) so when a v2
 * account/billing feature arrives, this leaf moves there without a key
 * migration. Standard tier — balance moves with usage, and a minute-stale
 * count is honest for an advisory line.
 *
 * `enabled` stays a call-site concern: the endpoint requires a real-user
 * token (guests 401), and the radar form is already gated to accounts.
 */
export const userLimitsQuery = ({ viewerId }: ViewerScoped) =>
  queryOptions({
    queryKey: ['user-limits', { viewerId }] as const,
    queryFn: () => messagePacksApi.getUserLimits(),
    staleTime: STALE_TIMES.standard,
  });
