'use client';

import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCourses, useCourts, useCountries } from '@/lib/hooks/useAdminCases';
import { cn } from '@/lib/utils';
import type { AdminCasesParams } from '@/types/admin-cases';

/******************************************************************************
                                Component Props
******************************************************************************/

interface CaseFiltersProps {
  params: AdminCasesParams;
  onParamsChange: (params: Partial<AdminCasesParams>) => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Filter controls for cases list
 * Filters by course, court, country, date range, and per-page
 */
export function CaseFilters({ params, onParamsChange }: CaseFiltersProps) {
  // Fetch filter options
  const { data: coursesData } = useCourses({ per_page: 100 });
  const { data: courtsData } = useCourts({ per_page: 100 });
  const { data: countriesData } = useCountries({ per_page: 100 });

  const courses = coursesData?.data || [];
  const courts = courtsData?.data || [];
  const countries = countriesData?.data || [];

  // Parse date strings to Date objects
  const fromDate = params.from_date ? new Date(params.from_date) : undefined;
  const toDate = params.to_date ? new Date(params.to_date) : undefined;

  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
      {/* Course Filter */}
      <Select
        value={params.course ? String(params.course) : 'all'}
        onValueChange={(value) =>
          onParamsChange({
            course: value === 'all' ? undefined : parseInt(value),
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Courses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Courses</SelectItem>
          {courses.map((course) => (
            <SelectItem key={course.id} value={String(course.id)}>
              {course.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Country Filter */}
      <Select
        value={params.country ? String(params.country) : 'all'}
        onValueChange={(value) =>
          onParamsChange({
            country: value === 'all' ? undefined : parseInt(value),
            court: undefined, // Reset court when country changes
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Countries" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Countries</SelectItem>
          {countries.map((country) => (
            <SelectItem key={country.id} value={String(country.id)}>
              {country.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Court Filter (filtered by selected country) */}
      <Select
        value={params.court ? String(params.court) : 'all'}
        onValueChange={(value) =>
          onParamsChange({
            court: value === 'all' ? undefined : parseInt(value),
            page: 1,
          })
        }
        disabled={params.country === undefined}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All Courts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Courts</SelectItem>
          {courts
            .filter(
              (court) =>
                !params.country || court.country.id === params.country
            )
            .map((court) => (
              <SelectItem key={court.id} value={String(court.id)}>
                {court.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      {/* Date Range: From Date */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[160px] justify-start text-left font-normal',
              !fromDate && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {fromDate ? format(fromDate, 'MMM d, yyyy') : 'From Date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={fromDate}
            onSelect={(date) =>
              onParamsChange({
                from_date: date ? format(date, 'yyyy-MM-dd') : undefined,
                page: 1,
              })
            }
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Date Range: To Date */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-[160px] justify-start text-left font-normal',
              !toDate && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {toDate ? format(toDate, 'MMM d, yyyy') : 'To Date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={toDate}
            onSelect={(date) =>
              onParamsChange({
                to_date: date ? format(date, 'yyyy-MM-dd') : undefined,
                page: 1,
              })
            }
            disabled={(date) => (fromDate ? date < fromDate : false)}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Clear Filters Button (only show if filters are active) */}
      {(params.course ||
        params.country ||
        params.court ||
        params.from_date ||
        params.to_date) && (
        <Button
          variant="ghost"
          onClick={() =>
            onParamsChange({
              course: undefined,
              country: undefined,
              court: undefined,
              from_date: undefined,
              to_date: undefined,
              page: 1,
            })
          }
        >
          Clear Filters
        </Button>
      )}

      {/* Per Page Selector */}
      <div className="ml-auto">
        <Select
          value={String(params.per_page || 15)}
          onValueChange={(value) =>
            onParamsChange({ per_page: parseInt(value), page: 1 })
          }
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / page</SelectItem>
            <SelectItem value="15">15 / page</SelectItem>
            <SelectItem value="25">25 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
