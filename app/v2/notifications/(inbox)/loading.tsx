import { NotificationsFallback } from '@/v2/features/notifications/NotificationsScreen';

/**
 * Route-level loading boundary for `/notifications` — the SAME component as
 * the screen's own Suspense fallback, so route boundary → Suspense fallback →
 * live list is one continuous shape and nothing moves at either hand-off. The
 * fallback owns its `aria-hidden` + `inert` and its skeleton, so this file
 * cannot drift from it.
 */
export default function NotificationsLoading() {
  return <NotificationsFallback />;
}
