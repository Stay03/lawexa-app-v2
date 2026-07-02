'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCourses, useCourts, useCountries } from '@/lib/hooks/useAdminCases';
import type { AdminCasesParams } from '@/types/admin-cases';

/******************************************************************************
                                Component Props
******************************************************************************/

interface CaseFiltersProps {
  params: AdminCasesParams;
  onParamsChange: (params: Partial<AdminCasesParams>) => void;
  /** Hide the course selector when the list is already scoped to one course. */
  hideCourseFilter?: boolean;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Filter controls for cases list
 * Filters by course, court, country, date range, and per-page
 */
export function CaseFilters({
  params,
  onParamsChange,
  hideCourseFilter = false,
}: CaseFiltersProps) {
  // Fetch filter options
  const { data: coursesData } = useCourses({ per_page: 100 });
  const { data: courtsData } = useCourts({ per_page: 100 });
  const { data: countriesData } = useCountries({ per_page: 100 });

  const courses = coursesData?.data || [];
  const courts = courtsData?.data || [];
  const countries = countriesData?.data || [];

  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
      {/* Course Filter */}
      {!hideCourseFilter && (
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
      )}

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
      <Input
        type="date"
        value={params.date_from || ''}
        onChange={(e) =>
          onParamsChange({
            date_from: e.target.value || undefined,
            page: 1,
          })
        }
        className="w-[160px]"
        placeholder="From Date"
      />

      {/* Date Range: To Date */}
      <Input
        type="date"
        value={params.date_to || ''}
        onChange={(e) =>
          onParamsChange({
            date_to: e.target.value || undefined,
            page: 1,
          })
        }
        className="w-[160px]"
        placeholder="To Date"
        min={params.date_from}
      />

      {/* Clear Filters Button (only show if filters are active) */}
      {(params.course ||
        params.country ||
        params.court ||
        params.date_from ||
        params.date_to) && (
        <Button
          variant="ghost"
          onClick={() =>
            onParamsChange({
              course: undefined,
              country: undefined,
              court: undefined,
              date_from: undefined,
              date_to: undefined,
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
