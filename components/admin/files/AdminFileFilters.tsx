'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminFileListParams } from '@/types/admin-files';

interface AdminFileFiltersProps {
  params: AdminFileListParams;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onParamsChange: (params: Partial<AdminFileListParams>) => void;
}

export function AdminFileFilters({
  params,
  searchValue,
  onSearchChange,
  onParamsChange,
}: AdminFileFiltersProps) {
  const hasActiveFilters =
    params.category ||
    params.disk ||
    params.upload_status ||
    params.mime_type ||
    params.created_from ||
    params.created_to ||
    params.size_min ||
    params.size_max;

  function clearFilters() {
    onParamsChange({
      category: undefined,
      disk: undefined,
      upload_status: undefined,
      mime_type: undefined,
      created_from: undefined,
      created_to: undefined,
      size_min: undefined,
      size_max: undefined,
      page: 1,
    });
    onSearchChange('');
  }

  return (
    <div className="space-y-3">
      {/* Row 1: Search + primary filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:w-[260px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by file name..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={params.category || '_all'}
          onValueChange={(v) =>
            onParamsChange({ category: v === '_all' ? undefined : v, page: 1 })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Categories</SelectItem>
            <SelectItem value="document">Document</SelectItem>
            <SelectItem value="content-image">Content Image</SelectItem>
            <SelectItem value="avatar">Avatar</SelectItem>
            <SelectItem value="case-report">Case Report</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={params.disk || '_all'}
          onValueChange={(v) =>
            onParamsChange({ disk: v === '_all' ? undefined : v, page: 1 })
          }
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Disk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Disks</SelectItem>
            <SelectItem value="local">Local</SelectItem>
            <SelectItem value="s3">S3</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={params.upload_status || '_all'}
          onValueChange={(v) =>
            onParamsChange({ upload_status: v === '_all' ? undefined : v, page: 1 })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Date range + size range + clear */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          type="date"
          value={params.created_from || ''}
          onChange={(e) =>
            onParamsChange({ created_from: e.target.value || undefined, page: 1 })
          }
          className="w-[160px]"
          max={params.created_to}
          placeholder="From date"
        />
        <span className="text-sm text-muted-foreground">to</span>
        <Input
          type="date"
          value={params.created_to || ''}
          onChange={(e) =>
            onParamsChange({ created_to: e.target.value || undefined, page: 1 })
          }
          className="w-[160px]"
          min={params.created_from}
          placeholder="To date"
        />

        <Input
          type="number"
          value={params.size_min ?? ''}
          onChange={(e) =>
            onParamsChange({
              size_min: e.target.value ? Number(e.target.value) : undefined,
              page: 1,
            })
          }
          className="w-[130px]"
          placeholder="Min size (bytes)"
          min={0}
        />
        <Input
          type="number"
          value={params.size_max ?? ''}
          onChange={(e) =>
            onParamsChange({
              size_max: e.target.value ? Number(e.target.value) : undefined,
              page: 1,
            })
          }
          className="w-[130px]"
          placeholder="Max size (bytes)"
          min={0}
        />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
