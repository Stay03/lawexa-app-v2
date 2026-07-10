'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/** Compact segmented control for a required, low-cardinality dimension. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn('inline-flex rounded-lg border p-0.5', className)}>
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          variant={value === opt.value ? 'default' : 'ghost'}
          size="sm"
          className="h-8"
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
