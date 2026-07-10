'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { humanizeStatus } from '@/lib/utils/observability';

const ALL = '__all__';

interface EnumFilterSelectProps {
  value: string | undefined;
  options: readonly string[];
  onChange: (value: string | undefined) => void;
  placeholder: string;
  allLabel?: string;
  className?: string;
  /** Provide custom labels for specific option values. */
  labelFor?: (value: string) => string;
}

/**
 * A Select over a fixed enum with an "All" sentinel that maps to `undefined`.
 * Used across observability filter bars (status, trigger, kind, …).
 */
export function EnumFilterSelect({
  value,
  options,
  onChange,
  placeholder,
  allLabel = 'All',
  className,
  labelFor,
}: EnumFilterSelectProps) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => onChange(v === ALL ? undefined : v)}
    >
      <SelectTrigger className={cn('h-9 w-[170px]', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {labelFor ? labelFor(opt) : humanizeStatus(opt)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
