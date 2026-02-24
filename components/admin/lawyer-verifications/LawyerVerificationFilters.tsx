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
import type {
  AdminLawyerVerificationsParams,
  LawyerVerificationStatus,
} from '@/types/admin-lawyer-verification';

interface LawyerVerificationFiltersProps {
  params: AdminLawyerVerificationsParams;
  onParamsChange: (params: Partial<AdminLawyerVerificationsParams>) => void;
}

/**
 * Status filter for the lawyer verifications list.
 * Renders a Select dropdown with All / Pending / Approved / Rejected options.
 */
export function LawyerVerificationFilters({
  params,
  onParamsChange,
}: LawyerVerificationFiltersProps) {
  const hasActiveFilters = params.status && params.status !== 'all';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          Status:
        </label>
        <Select
          value={params.status || 'all'}
          onValueChange={(value) =>
            onParamsChange({
              status: value as LawyerVerificationStatus,
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onParamsChange({ status: undefined, page: 1 })}
          className="h-9"
        >
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
