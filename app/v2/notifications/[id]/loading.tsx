import { SegmentFallback } from '@/v2/shell/segment-fallback';

/**
 * Route-level loading boundary for `/notifications/{id}`. Neutral on purpose:
 * the resolver paints nothing of its own before it redirects, so any silhouette
 * here would be a lie about where the reader is going.
 */
export default function NotificationLoading() {
  return <SegmentFallback label="Opening notification" />;
}
