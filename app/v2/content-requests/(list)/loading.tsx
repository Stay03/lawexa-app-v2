import { RequestsFallback } from '@/v2/features/settings/requests/states';

/**
 * Route-level loading boundary for `/content-requests`: the same silhouette the
 * screen draws while its first page loads.
 */
export default function RequestsLoading() {
  return <RequestsFallback />;
}
