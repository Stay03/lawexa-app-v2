import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/layout';

/** Card placeholders for the spaces grid — mirrors SpaceCard. */
export function SpacesListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          {/* member-count row (SpaceCard's mt-4 footer) */}
          <Skeleton className="mt-4 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Row placeholders for a space's channel list — mirrors ChannelRow. */
export function ChannelListSkeleton() {
  return (
    <div className="space-y-2">
      {[40, 28, 36, 32, 44].map((nameWidth, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
        >
          <Skeleton className="h-4 w-4 shrink-0 rounded" />
          <Skeleton className="h-4" style={{ width: `${nameWidth}%` }} />
          <Skeleton className="ml-auto h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Grouped message placeholders — mirrors MessageGroup (avatar + header + line). */
export function MessageListSkeleton() {
  return (
    <div className="space-y-5 py-4">
      {[80, 55, 65, 40, 72].map((width, i) => (
        <div key={i} className="flex gap-3 px-1">
          <Skeleton className="mt-0.5 h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-4" style={{ width: `${width}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full spaces-list page — header + tabs + grid. Used by the route guard. */
export function SpacesPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-72 max-w-[80vw]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <Skeleton className="h-9 w-52 rounded-md" />
      <SpacesListSkeleton />
    </div>
  );
}

/** Full space-detail page — identity header + channels section. */
export function SpaceDetailSkeleton() {
  return (
    <PageContainer>
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="h-4 w-48 max-w-full" />
        </div>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
        <ChannelListSkeleton />
      </div>
    </PageContainer>
  );
}

/** Full channel reader — header + message history + composer bar. */
export function ChannelViewSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b px-4 pb-3 pt-4">
        <div className="mx-auto w-full max-w-3xl space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="h-3 w-52 max-w-full" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-3xl px-4">
          <MessageListSkeleton />
        </div>
      </div>
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-[68px] w-full rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
