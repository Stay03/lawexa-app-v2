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
import type { ViewAnalyticsPeriod } from '@/types/admin';

interface ViewAnalyticsPeriodSelectorProps {
  period: ViewAnalyticsPeriod;
  date?: string;
  startDate?: string;
  endDate?: string;
  onPeriodChange: (period: ViewAnalyticsPeriod) => void;
  onDateChange: (date: string) => void;
  onDateRangeChange: (startDate: string, endDate: string) => void;
}

const VIEW_PERIOD_LABELS: Record<ViewAnalyticsPeriod, string> = {
  today: 'Today',
  last_24_hours: 'Last 24 Hours',
  date: 'Specific Date',
  this_week: 'This Week',
  last_7_days: 'Last 7 Days',
  this_month: 'This Month',
  last_30_days: 'Last 30 Days',
  date_range: 'Date Range',
};

/**
 * Period selector for view analytics with support for single date and date range inputs.
 */
export function ViewAnalyticsPeriodSelector({
  period,
  date,
  startDate,
  endDate,
  onPeriodChange,
  onDateChange,
  onDateRangeChange,
}: ViewAnalyticsPeriodSelectorProps) {
  const [singleDate, setSingleDate] = useState(date || '');
  const [customStart, setCustomStart] = useState(startDate || '');
  const [customEnd, setCustomEnd] = useState(endDate || '');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  /**
   * Handle preset period change.
   */
  function handlePeriodChange(value: string) {
    const newPeriod = value as ViewAnalyticsPeriod;
    if (newPeriod === 'date' || newPeriod === 'date_range') {
      setIsPopoverOpen(true);
      onPeriodChange(newPeriod);
    } else {
      onPeriodChange(newPeriod);
    }
  }

  /**
   * Apply single date selection.
   */
  function handleApplyDate() {
    if (singleDate) {
      onDateChange(singleDate);
      setIsPopoverOpen(false);
    }
  }

  /**
   * Apply custom date range.
   */
  function handleApplyDateRange() {
    if (customStart && customEnd) {
      onDateRangeChange(customStart, customEnd);
      setIsPopoverOpen(false);
    }
  }

  // Determine popover display label
  const popoverLabel =
    period === 'date' && date
      ? date
      : period === 'date_range' && startDate && endDate
        ? `${startDate} - ${endDate}`
        : period === 'date'
          ? 'Select date'
          : 'Select dates';

  const showPopover = period === 'date' || period === 'date_range';

  return (
    <div className="flex items-center gap-2">
      <Select value={period} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(VIEW_PERIOD_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showPopover && (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {popoverLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            {period === 'date' ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Select Date</p>
                <div>
                  <label className="text-xs text-muted-foreground">Date</label>
                  <Input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleApplyDate}
                  disabled={!singleDate}
                >
                  Apply
                </Button>
              </div>
            ) : (
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
                  onClick={handleApplyDateRange}
                  disabled={!customStart || !customEnd}
                >
                  Apply
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
