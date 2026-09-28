import { NotificationsFallback } from '@/v2/features/settings/notifications/states';

/**
 * Route-level loading boundary for `/settings/notifications`: the screen's own
 * silhouette (three groups), so the hand-off moves nothing.
 */
export default function NotificationSettingsLoading() {
  return <NotificationsFallback />;
}
