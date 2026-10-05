'use client';

import { cn } from '@/lib/utils';

/**
 * A two- or three-way choice drawn as one pill: real radio inputs, visually
 * hidden, so the group gets arrow keys, one tab stop and its name announced
 * from the browser (the reasoning in `SettingsForm`'s choice group). The chosen
 * segment is lifted on to the page colour and the change moves over 150ms.
 */
export function SegmentedChoice<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  options: { value: T; label: string; hint: string | null }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex max-w-full items-center rounded-full bg-muted p-1">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'v2-interactive relative flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-medium md:min-h-9',
                'transition-colors duration-150 motion-reduce:transition-none',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                selected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
              {option.hint ? (
                <span className="text-xs font-normal text-muted-foreground">{option.hint}</span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
