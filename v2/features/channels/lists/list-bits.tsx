import { cn } from '@/lib/utils';
import type { SlimUser } from '@/types/collab';
import { LawexaAvatar, MemberAvatar } from '../ui/avatars';

/**
 * list-bits — the two atoms the Lists index rows AND the detail header share:
 * the completion bar and the creator identity label. One home so the two
 * surfaces can't drift (v2 ports of v1's `ListProgress` / `ListCreatorLabel`;
 * study A5 KEEP). Phase-5 W2, 2026-08-04.
 */

/** A slim completion bar; complete lists tint to the emerald "done" hue. */
export function ListProgress({
  checked,
  total,
  showCount = true,
  className,
}: {
  checked: number;
  total: number;
  showCount?: boolean;
  className?: string;
}) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, checked / total)) : 0;
  const isComplete = total > 0 && checked >= total;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={checked}
        aria-label={`${checked} of ${total} items complete`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none',
            isComplete ? 'bg-emerald-500' : 'bg-primary',
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {showCount && (
        <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
          {checked}/{total}
        </span>
      )}
    </div>
  );
}

/** The identity behind a list or item: Lawexa when `is_ai` (NEVER inferred
 *  from `creator === null` — that is a removed account; digest §F.3). */
export function ListCreatorLabel({
  isAi,
  creator,
  className,
}: {
  isAi: boolean;
  creator: SlimUser | null;
  className?: string;
}) {
  const name = isAi ? 'Lawexa' : (creator?.name ?? 'Unknown');
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground',
        className,
      )}
    >
      {isAi ? <LawexaAvatar size="sm" /> : <MemberAvatar user={creator} size="sm" />}
      <span className="truncate">{name}</span>
    </span>
  );
}
