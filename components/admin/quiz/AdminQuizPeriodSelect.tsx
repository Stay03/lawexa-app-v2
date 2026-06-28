'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminQuizPeriod } from '@/types/admin-quiz';

/** Named-range period options (custom date / date_range pickers are deferred). */
const PERIODS: { value: AdminQuizPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last_24_hours', label: 'Last 24 hours' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_30_days', label: 'Last 30 days' },
];

interface AdminQuizPeriodSelectProps {
  value: AdminQuizPeriod;
  onChange: (period: AdminQuizPeriod) => void;
}

export function AdminQuizPeriodSelect({
  value,
  onChange,
}: AdminQuizPeriodSelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AdminQuizPeriod)}>
      <SelectTrigger className="h-9 w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
