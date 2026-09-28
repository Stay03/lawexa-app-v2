import { DeveloperFallback } from '@/v2/features/settings/developer/states';

/**
 * Route-level loading boundary for `/settings/developer`: the screen's own
 * silhouette (one block of two rows), not the settings list's, so the hand-off
 * moves nothing.
 */
export default function DeveloperSettingsLoading() {
  return <DeveloperFallback />;
}
