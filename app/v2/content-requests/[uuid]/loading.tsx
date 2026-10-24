import { RequestFallback } from '@/v2/features/settings/requests/states';

/**
 * Route-level loading boundary for `/content-requests/{uuid}`: the same
 * silhouette the screen draws while the request loads.
 */
export default function RequestLoading() {
  return <RequestFallback />;
}
