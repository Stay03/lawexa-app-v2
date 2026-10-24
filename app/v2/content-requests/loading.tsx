import { SegmentFallback } from '@/v2/shell/segment-fallback';

/**
 * The `content-requests` SEGMENT boundary, neutral, by the rules in
 * `app/v2/loading.tsx`. Its two children do not share a shape: the list is
 * rows, and `/content-requests/{uuid}` is one request. Each has its own
 * boundary beside it (`(list)/loading.tsx`, `[uuid]/loading.tsx`), which takes
 * over the moment its shell arrives.
 */
export default function ContentRequestsSegmentLoading() {
  return <SegmentFallback label="Loading your requests" />;
}
