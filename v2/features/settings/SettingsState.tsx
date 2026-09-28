import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A settings screen that cannot show its content: an icon, a title, one
 * sentence and an optional action, centred in the column. The refusals are
 * `quiet`; a failed read is `alarm`, so the two never look alike.
 *
 * Shared by every settings screen that reads data (Profile first; moved here
 * from `profile/states.tsx` when Signed-in devices needed the same states).
 */
export function SettingsState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'quiet',
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: 'quiet' | 'alarm';
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <span
        aria-hidden
        className={cn(
          'flex size-12 items-center justify-center rounded-2xl',
          tone === 'alarm'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-secondary text-muted-foreground',
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
