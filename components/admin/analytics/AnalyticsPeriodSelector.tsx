'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';
import type { AnalyticsPeriod } from '@/types/admin';

interface AnalyticsPeriodSelectorProps {
  period: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  onCustomRangeChange: (startDate: string, endDate: string) => void;
}

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  today: 'Today',
  last_7_days: 'Last 7 days',
  last_30_days: 'Last 30 days',
  date_range: 'Custom Range',
};

export function AnalyticsPeriodSelector({
  period,
  startDate,
  endDate,
  onPeriodChange,
  onCustomRangeChange,
}: AnalyticsPeriodSelectorProps) {
  const [customStart, setCustomStart] = useState(startDate || '');
  const [customEnd, setCustomEnd] = useState(endDate || '');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  /**
   * Handle preset period change.
   */
  function handlePeriodChange(value: string) {
    const newPeriod = value as AnalyticsPeriod;
    if (newPeriod === 'date_range') {
      setIsPopoverOpen(true);
    } else {
      onPeriodChange(newPeriod);
    }
  }

  /**
   * Apply custom date range.
   */
  function handleApplyCustomRange() {
    if (customStart && customEnd) {
      onCustomRangeChange(customStart, customEnd);
      setIsPopoverOpen(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={period} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PERIOD_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {period === 'date_range' && (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {startDate && endDate
                ? `${startDate} - ${endDate}`
                : 'Select dates'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <p className="text-sm font-medium">Custom Date Range</p>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Start Date</label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">End Date</label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={handleApplyCustomRange}
                disabled={!customStart || !customEnd}
              >
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
