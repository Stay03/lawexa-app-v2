import { UsageFallback } from '@/v2/features/settings/usage/states';

/**
 * Route-level loading boundary for `/settings/usage`: the same silhouette the
 * screen draws while it reads, so the hand-off moves nothing.
 */
export default function UsageLoading() {
  return <UsageFallback />;
}
