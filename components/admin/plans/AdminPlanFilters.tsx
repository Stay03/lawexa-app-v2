'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminPlansParams } from '@/types/admin-plans';

interface AdminPlanFiltersProps {
  params: AdminPlansParams;
  onParamsChange: (updates: Partial<AdminPlansParams>) => void;
}

export function AdminPlanFilters({
  params,
  onParamsChange,
}: AdminPlanFiltersProps) {
  const activeValue =
    params.is_active === true
      ? 'active'
      : params.is_active === false
        ? 'inactive'
        : 'all';

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Select
        value={activeValue}
        onValueChange={(value) => {
          onParamsChange({
            is_active:
              value === 'active' ? true : value === 'inactive' ? false : undefined,
            page: 1,
          });
        }}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Plans</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
