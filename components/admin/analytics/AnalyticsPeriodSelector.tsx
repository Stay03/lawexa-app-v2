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

/******************************************************************************
                                 Constants
******************************************************************************/

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  today: 'Today',
  last_24_hours: 'Last 24 Hours',
  date: 'Specific Date',
  this_week: 'This Week',
  last_7_days: 'Last 7 Days',
  this_month: 'This Month',
  last_30_days: 'Last 30 Days',
  date_range: 'Date Range',
};

/******************************************************************************
                                 Functions
******************************************************************************/

/**
 * Format an ISO date string (YYYY-MM-DD) to a human-readable display format.
 */
function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/******************************************************************************
                                 Types
******************************************************************************/

interface AnalyticsPeriodSelectorProps {
  period: AnalyticsPeriod;
  date?: string;
  startDate?: string;
  endDate?: string;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  onDateChange?: (date: string) => void;
  onCustomRangeChange: (startDate: string, endDate: string) => void;
}

/******************************************************************************
                                 Component
******************************************************************************/

export function AnalyticsPeriodSelector({
  period,
  date,
  startDate,
  endDate,
  onPeriodChange,
  onDateChange,
  onCustomRangeChange,
}: AnalyticsPeriodSelectorProps) {
  const [singleDate, setSingleDate] = useState(date || '');
  const [customStart, setCustomStart] = useState(startDate || '');
  const [customEnd, setCustomEnd] = useState(endDate || '');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const isRangeInvalid = customStart && customEnd && customEnd < customStart;

  function handlePeriodChange(value: string) {
    const newPeriod = value as AnalyticsPeriod;
    if (newPeriod === 'date' || newPeriod === 'date_range') {
      setIsPopoverOpen(true);
      onPeriodChange(newPeriod);
    } else {
      onPeriodChange(newPeriod);
    }
  }

  function handleApplyDate() {
    if (singleDate) {
      onDateChange?.(singleDate);
      setIsPopoverOpen(false);
    }
  }

  function handleApplyDateRange() {
    if (customStart && customEnd && !isRangeInvalid) {
      onCustomRangeChange(customStart, customEnd);
      setIsPopoverOpen(false);
    }
  }

  const popoverLabel =
    period === 'date' && date
      ? formatDisplayDate(date)
      : period === 'date_range' && startDate && endDate
        ? `${formatDisplayDate(startDate)} – ${formatDisplayDate(endDate)}`
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
          {Object.entries(PERIOD_LABELS).map(([value, label]) => (
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
                <div>
                  <p className="text-sm font-medium">Custom Date Range</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    End date must be after start date
                  </p>
                </div>
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
                {isRangeInvalid && (
                  <p className="text-xs text-destructive">
                    End date must be on or after start date
                  </p>
                )}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleApplyDateRange}
                  disabled={!customStart || !customEnd || !!isRangeInvalid}
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
