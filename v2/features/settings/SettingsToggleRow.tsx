'use client';

import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

/**
 * ONE settings row that is a switch: the link row's icon, label and quiet line
 * (`SettingsLinkRow` in `SettingsList.tsx`), with the switch at the end.
 *
 * Same 56px floor, padding and type as the link row, so a block may mix the
 * two and still read as one list. The whole row is the switch's label:
 * tapping the words flips it, as on a phone's settings screen. The switch
 * saves the moment it moves; v2 settings has no Save bar anywhere (the
 * owner's rule from Profile, 21 September 2026).
 *
 * Its own file because it holds state hooks, and `SettingsList.tsx` must stay
 * a server-safe module: server pages import its class constants, and a
 * constant exported from a `'use client'` file reaches a server component as
 * a client reference, not as the string.
 */
export function SettingsToggleRow({
  icon: Icon,
  label,
  hint,
  checked,
  onCheckedChange,
  disabled = false,
  dimmed = false,
}: {
  icon: LucideIcon;
  label: string;
  /** The quiet line under the label: what the switch does, in one sentence. */
  hint?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  /** The platform refuses it (no push in this browser): shown, not operable. */
  disabled?: boolean;
  /**
   * Has no effect right now (alerts while paused): drawn faded, still
   * operable, so a choice can be arranged before it takes effect again.
   */
  dimmed?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <li>
      <label
        htmlFor={id}
        className={cn(
          'group flex min-h-14 items-center gap-3.5 px-4 py-2.5 transition-[opacity,background-color] duration-150 motion-reduce:transition-none',
          disabled
            ? 'cursor-not-allowed opacity-60'
            : 'cursor-pointer hover:bg-foreground/[0.04]',
          dimmed && !disabled && 'opacity-60',
        )}
      >
        <Icon
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-foreground motion-reduce:transition-none"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] leading-snug font-medium text-foreground">
            {label}
          </span>
          {hint != null ? (
            <span id={hintId} className="text-[13px] leading-snug text-muted-foreground">
              {hint}
            </span>
          ) : null}
        </span>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-describedby={hint != null ? hintId : undefined}
          className="shrink-0"
        />
      </label>
    </li>
  );
}
