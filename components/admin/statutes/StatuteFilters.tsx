'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useCountries } from '@/lib/hooks/useAdminCases';
import type { AdminStatutesParams } from '@/types/admin-statutes';

/******************************************************************************
                                Component Props
******************************************************************************/

interface StatuteFiltersProps {
  params: AdminStatutesParams;
  onParamsChange: (params: Partial<AdminStatutesParams>) => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

export function StatuteFilters({ params, onParamsChange }: StatuteFiltersProps) {
  const { data: countriesData } = useCountries({ per_page: 100 });
  const countries = countriesData?.data || [];

  return (
    <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
      {/* Country Filter */}
      <Select
        value={params.country ? String(params.country) : 'all'}
        onValueChange={(value) =>
          onParamsChange({
            country: value === 'all' ? undefined : parseInt(value),
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

      {/* Status Filter */}
      <Select
        value={params.status || 'all'}
        onValueChange={(value) =>
          onParamsChange({
            status: value === 'all' ? undefined : (value as AdminStatutesParams['status']),
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="amended">Amended</SelectItem>
          <SelectItem value="repealed">Repealed</SelectItem>
        </SelectContent>
      </Select>

      {/* Year Filter */}
      <Select
        value={params.year ? String(params.year) : 'all'}
        onValueChange={(value) =>
          onParamsChange({
            year: value === 'all' ? undefined : parseInt(value),
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="All Years" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Years</SelectItem>
          {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(
            (year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            )
          )}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {(params.country || params.status || params.year) && (
        <Button
          variant="ghost"
          onClick={() =>
            onParamsChange({
              country: undefined,
              status: undefined,
              year: undefined,
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
