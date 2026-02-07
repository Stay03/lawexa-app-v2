'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminAiWorkflowsParams } from '@/types/admin-ai';

interface AiWorkflowFiltersProps {
  params: AdminAiWorkflowsParams;
  onParamsChange: (params: Partial<AdminAiWorkflowsParams>) => void;
}

export function AiWorkflowFilters({
  params,
  onParamsChange,
}: AiWorkflowFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Active Filter */}
      <Select
        value={
          params.active_only === undefined
            ? 'all'
            : params.active_only
              ? 'active'
              : 'inactive'
        }
        onValueChange={(value) =>
          onParamsChange({
            active_only:
              value === 'all' ? undefined : value === 'active',
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      {/* Per Page Selector */}
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
  );
}
