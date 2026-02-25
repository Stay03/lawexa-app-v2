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
import type { AdminLawyerConnectListParams } from '@/types/admin-lawyer-connect';

interface LawyerConnectFiltersProps {
  params: AdminLawyerConnectListParams;
  onParamsChange: (params: Partial<AdminLawyerConnectListParams>) => void;
}

export function LawyerConnectFilters({
  params,
  onParamsChange,
}: LawyerConnectFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Lawyer UUID Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter by Lawyer UUID..."
          value={params.lawyer_uuid || ''}
          onChange={(e) =>
            onParamsChange({ lawyer_uuid: e.target.value || undefined, page: 1 })
          }
          className="pl-9 pr-9"
        />
        {params.lawyer_uuid && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => onParamsChange({ lawyer_uuid: undefined, page: 1 })}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Status Filter */}
      <Select
        value={params.status ?? 'all'}
        onValueChange={(value) =>
          onParamsChange({
            status: value === 'all' ? undefined : (value as AdminLawyerConnectListParams['status']),
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="accepted">Accepted</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort Order */}
      <Select
        value={params.sort_order ?? 'desc'}
        onValueChange={(value) =>
          onParamsChange({ sort_order: value as 'asc' | 'desc', page: 1 })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">Newest first</SelectItem>
          <SelectItem value="asc">Oldest first</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
