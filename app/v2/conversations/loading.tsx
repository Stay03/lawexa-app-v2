import { Skeleton } from '@/components/ui/skeleton';
import { ConversationsListSkeleton } from '@/v2/features/conversations/list/states';

/**
 * Route-level loading boundary for `/conversations`. Mirrors the page's own
 * Suspense fallback EXACTLY (same search-pill + list-skeleton geometry, reusing
 * the same components) so the loading boundary → fallback → resolved-list
 * sequence is one continuous skeleton with zero shape jumps — never the v2
 * root's generic boundary, and never text (skeleton-first standing rule).
 */
export default function ConversationsLoading() {
  return (
    <div
      aria-hidden
      className="mx-auto w-full max-w-2xl px-4 pb-16 pt-5 sm:pt-6"
    >
      <Skeleton className="mb-4 h-11 w-full rounded-4xl" />
      <ConversationsListSkeleton />
    </div>
  );
}
