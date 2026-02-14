'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminContentRequestsParams, ContentRequestStatus, ContentRequestType } from '@/types/content-request';

/******************************************************************************
                                Component Props
******************************************************************************/

interface ContentRequestFiltersProps {
  params: AdminContentRequestsParams;
  onParamsChange: (params: Partial<AdminContentRequestsParams>) => void;
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Filter component for content requests list
 * Provides status and type filters with clear functionality
 */
export function ContentRequestFilters({
  params,
  onParamsChange,
}: ContentRequestFiltersProps) {
  const hasActiveFilters = params.status || params.type;

  const handleClearFilters = () => {
    onParamsChange({
      status: undefined,
      type: undefined,
      page: 1, // Reset to first page when clearing filters
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="status-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          Status:
        </label>
        <Select
          value={params.status || 'all'}
          onValueChange={(value) =>
            onParamsChange({
              status: value === 'all' ? undefined : (value as ContentRequestStatus),
              page: 1, // Reset to first page on filter change
            })
          }
        >
          <SelectTrigger id="status-filter" className="w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Type Filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="type-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          Type:
        </label>
        <Select
          value={params.type || 'all'}
          onValueChange={(value) =>
            onParamsChange({
              type: value === 'all' ? undefined : (value as ContentRequestType),
              page: 1, // Reset to first page on filter change
            })
          }
        >
          <SelectTrigger id="type-filter" className="w-[150px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="case">Case</SelectItem>
            <SelectItem value="note">Note</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="h-9"
        >
          <X className="mr-1 h-4 w-4" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
