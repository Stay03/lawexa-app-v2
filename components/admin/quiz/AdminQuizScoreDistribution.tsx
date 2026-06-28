import type { AdminQuizScoreBucket } from '@/types/admin-quiz';

/** Bar colour banded by the bucket's lower bound (low → high score). */
function bucketColor(bucket: string): string {
  const lower = parseInt(bucket, 10);
  if (!Number.isFinite(lower)) return '#3b82f6';
  if (lower < 40) return '#ef4444'; // rose — weak
  if (lower < 70) return '#f59e0b'; // amber — middling
  return '#22c55e'; // emerald — strong
}

/** Distribution of session scores across buckets (e.g. "0-20", "80-100"). */
export function AdminQuizScoreDistribution({
  data,
}: {
  data: AdminQuizScoreBucket[];
}) {
  const total = data.reduce((sum, b) => sum + b.count, 0);

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        No completed sessions in this period.
      </div>
    );
  }

  const max = Math.max(...data.map((b) => b.count));

  return (
    <div className="space-y-3">
      {data.map((b) => {
        const width = max > 0 ? (b.count / max) * 100 : 0;
        return (
          <div key={b.bucket} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">
                {b.bucket}%
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {b.count.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/50">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${width}%`, backgroundColor: bucketColor(b.bucket) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
