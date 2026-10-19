import { queryOptions } from '@tanstack/react-query';
import { messagePacksApi } from '@/lib/api/message-packs';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * The account's AI-message limits (`GET /users/limits`): the review dialog's
 * "N messages left" line on New radar, and the out-of-messages notice's block
 * when the surface did not receive one itself (a chat's error row). A v2 query
 * leaf over the shared `lib/api` fetcher (the v1 `useUserLimits` hook is
 * boundary-blocked). Moved here from the radar create flow when the notice
 * became its second reader; the key did not change.
 *
 * VIEWER-SCOPED like every other authed leaf: the balance is per-account
 * data, and an unscoped key could show the previous account's count for a
 * staleTime window after a switch in the same tab. Standard tier: the balance
 * moves with usage, and a purchase invalidates `['user-limits']` itself.
 *
 * `enabled` stays a call-site concern: the endpoint requires a real account
 * (a guest gets a 401).
 */
export const userLimitsQuery = ({ viewerId }: { viewerId: number | null }) =>
  queryOptions({
    queryKey: ['user-limits', { viewerId }] as const,
    queryFn: () => messagePacksApi.getUserLimits(),
    staleTime: STALE_TIMES.standard,
  });
