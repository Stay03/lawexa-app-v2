import { SegmentFallback } from '@/v2/shell/segment-fallback';

/**
 * The `notifications` SEGMENT boundary — neutral, by the rules in
 * `app/v2/loading.tsx`. Its two children do not share a shape: the inbox is a
 * list, and `/notifications/{id}` is a resolver that paints nothing before it
 * redirects. Each has its own boundary beside it (`(inbox)/loading.tsx`,
 * `[id]/loading.tsx`), which takes over the moment its shell arrives.
 */
export default function NotificationsSegmentLoading() {
  return <SegmentFallback label="Loading notifications" />;
}
