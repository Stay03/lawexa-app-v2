import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading skeleton that mirrors the editorial note detail layout.
 */
function NoteDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-5 pb-24 sm:px-6">
      {/* Eyebrow */}
      <Skeleton className="h-2.5 w-28 rounded-sm" />

      {/* Title — two lines, balanced */}
      <div className="space-y-3">
        <Skeleton className="h-9 w-11/12 rounded-md sm:h-10" />
        <Skeleton className="h-9 w-7/12 rounded-md sm:h-10" />
      </div>

      {/* Italic meta line */}
      <Skeleton className="h-4 w-2/3 rounded-sm" />

      {/* Tag row */}
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        <Skeleton className="h-3 w-20 rounded-sm" />
        <Skeleton className="h-3 w-24 rounded-sm" />
        <Skeleton className="h-3 w-16 rounded-sm" />
        <Skeleton className="h-3 w-28 rounded-sm" />
      </div>

      {/* Hairline rule */}
      <Skeleton className="h-px w-full rounded-none" />

      {/* Action row */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>

      {/* Article body — drop-cap simulator + flowing lines */}
      <div className="pt-3">
        <div className="flex gap-3">
          <Skeleton className="h-20 w-14 shrink-0 rounded-md sm:h-24 sm:w-16" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-10/12" />
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-9/12" />
        </div>

        {/* H2-ish subhead */}
        <Skeleton className="mt-8 h-6 w-2/5 rounded-md" />
        <div className="mt-3 space-y-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-10/12" />
        </div>

        {/* H3-ish italic */}
        <Skeleton className="mt-7 h-5 w-1/3 rounded-md" />
        <div className="mt-3 space-y-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-8/12" />
        </div>
      </div>

      {/* Author footer */}
      <div className="mt-6 border-t border-foreground/10 pt-8">
        <Skeleton className="mb-3 h-2.5 w-24 rounded-sm" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

export { NoteDetailSkeleton };
