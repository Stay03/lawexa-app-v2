'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AdminMessagePacksParams } from '@/types/admin';

/******************************************************************************
                                 Types
******************************************************************************/

interface AdminMessagePackFiltersProps {
  params: AdminMessagePacksParams;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onParamsChange: (params: Partial<AdminMessagePacksParams>) => void;
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Filters for the admin message packs list.
 */
function AdminMessagePackFilters({
  params,
  searchValue,
  onSearchChange,
  onParamsChange,
}: AdminMessagePackFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search by name or email */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => onSearchChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Status Filter */}
      <Select
        value={params.status || 'all'}
        onValueChange={(v) =>
          onParamsChange({
            status: v === 'all' ? undefined : (v as AdminMessagePacksParams['status']),
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="refunded">Refunded</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export { AdminMessagePackFilters };
