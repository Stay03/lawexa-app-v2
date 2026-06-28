'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { AdminQuizPeriod, AdminQuizPeriodParams } from '@/types/admin-quiz';

/** All named ranges plus the two custom modes (single day / custom range). */
const PERIODS: { value: AdminQuizPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last_24_hours', label: 'Last 24 hours' },
  { value: 'date', label: 'Single day' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'date_range', label: 'Custom range' },
];

interface AdminQuizPeriodSelectProps {
  value: AdminQuizPeriodParams;
  onChange: (value: AdminQuizPeriodParams) => void;
}

/**
 * Period picker over the shared period contract. Emits `onChange` only with
 * *complete* params — a `date` window once a day is picked, a `date_range`
 * window once both ends are set (and start ≤ end) — so the caller's query never
 * fires an incomplete custom range (which the backend would reject with 422).
 */
export function AdminQuizPeriodSelect({
  value,
  onChange,
}: AdminQuizPeriodSelectProps) {
  const [period, setPeriod] = useState<AdminQuizPeriod>(
    value.period ?? 'last_30_days'
  );
  const [date, setDate] = useState(value.date ?? '');
  const [start, setStart] = useState(value.start_date ?? '');
  const [end, setEnd] = useState(value.end_date ?? '');

  const selectPeriod = (next: AdminQuizPeriod) => {
    setPeriod(next);
    if (next === 'date') {
      if (date) onChange({ period: 'date', date });
    } else if (next === 'date_range') {
      if (start && end && start <= end) {
        onChange({ period: 'date_range', start_date: start, end_date: end });
      }
    } else {
      onChange({ period: next });
    }
  };

  const changeDate = (v: string) => {
    setDate(v);
    if (v) onChange({ period: 'date', date: v });
  };
  const changeStart = (v: string) => {
    setStart(v);
    if (v && end && v <= end) {
      onChange({ period: 'date_range', start_date: v, end_date: end });
    }
  };
  const changeEnd = (v: string) => {
    setEnd(v);
    if (start && v && start <= v) {
      onChange({ period: 'date_range', start_date: start, end_date: v });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={period}
        onValueChange={(v) => selectPeriod(v as AdminQuizPeriod)}
      >
        <SelectTrigger className="h-9 w-[150px]">
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

      {period === 'date' && (
        <Input
          type="date"
          aria-label="Day"
          value={date}
          onChange={(e) => changeDate(e.target.value)}
          className="h-9 w-[150px]"
        />
      )}

      {period === 'date_range' && (
        <>
          <Input
            type="date"
            aria-label="Start date"
            value={start}
            max={end || undefined}
            onChange={(e) => changeStart(e.target.value)}
            className="h-9 w-[150px]"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="End date"
            value={end}
            min={start || undefined}
            onChange={(e) => changeEnd(e.target.value)}
            className="h-9 w-[150px]"
          />
        </>
      )}
    </div>
  );
}
