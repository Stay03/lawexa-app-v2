'use client';

import { formatFullTimestamp } from '@/lib/utils/collab';
import { formatRelativeTime } from '@/v2/shell/designs/modules';
import { useMinuteNow } from '../use-minute-now';

/**
 * RelativeTime — the channel feature's ONE relative timestamp: the house
 * compact grammar ("3m", "2h", "4d") off the shared minute clock, exact
 * absolute on hover (`title`). Exists because v1's `formatRelativeTime`
 * (date-fns `formatDistanceToNow`) reads Date.now IN RENDER — banned by the
 * React Compiler rules — and speaks a different grammar ("5 minutes ago")
 * than the two-zone meta line (audit M6). Used by the Lists index/detail and
 * the Files rows; the feed's group header carries its own variant with the
 * same clock. Empty until the clock hydrates — these surfaces are
 * query-backed and never SSR rows, so nothing blank ever paints.
 */
export function RelativeTime({
  iso,
  prefix,
  className,
}: {
  iso: string;
  /** Leading word, e.g. "Updated" — rendered only once the age resolves. */
  prefix?: string;
  className?: string;
}) {
  const now = useMinuteNow();
  const compact = now > 0 ? formatRelativeTime(iso, now) : '';

  return (
    <time dateTime={iso} title={formatFullTimestamp(iso)} className={className}>
      {compact && (prefix ? `${prefix} ${compact}` : compact)}
    </time>
  );
}
