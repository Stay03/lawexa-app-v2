import { cn } from '@/lib/utils';

interface NotificationListSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Loading skeleton for notification list with fading effect.
 */
function NotificationListSkeleton({ count = 5, className }: NotificationListSkeletonProps) {
  const opacityValues = [1, 0.8, 0.5, 0.25, 0.1];

  return (
    <div
      className={cn(
        'divide-y divide-border/50 overflow-hidden rounded-lg',
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 px-5 py-4"
          style={{ opacity: opacityValues[i] ?? 0.1 }}
        >
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export { NotificationListSkeleton };
