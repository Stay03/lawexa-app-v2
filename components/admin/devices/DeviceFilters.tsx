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
import type { DeviceListParams } from '@/types/admin-devices';

interface DeviceFiltersProps {
  params: DeviceListParams;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onParamsChange: (params: Partial<DeviceListParams>) => void;
}

export function DeviceFilters({
  params,
  searchValue,
  onSearchChange,
  onParamsChange,
}: DeviceFiltersProps) {
  const hasActiveFilters =
    params.country ||
    params.device_type ||
    params.browser ||
    params.platform ||
    params.date_from ||
    params.date_to;

  function clearFilters() {
    onParamsChange({
      country: undefined,
      device_type: undefined,
      browser: undefined,
      platform: undefined,
      date_from: undefined,
      date_to: undefined,
      'role[]': undefined,
      page: 1,
    });
    onSearchChange('');
  }

  return (
    <div className="space-y-3">
      {/* Row 1: Search + primary filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:w-[280px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search device, IP, fingerprint, user..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select
          value={params.device_type || '_all'}
          onValueChange={(v) =>
            onParamsChange({ device_type: v === '_all' ? undefined : v as DeviceListParams['device_type'], page: 1 })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Device Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Types</SelectItem>
            <SelectItem value="desktop">Desktop</SelectItem>
            <SelectItem value="mobile">Mobile</SelectItem>
            <SelectItem value="tablet">Tablet</SelectItem>
            <SelectItem value="bot">Bot</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={params.browser || '_all'}
          onValueChange={(v) =>
            onParamsChange({ browser: v === '_all' ? undefined : v, page: 1 })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Browser" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Browsers</SelectItem>
            <SelectItem value="Chrome">Chrome</SelectItem>
            <SelectItem value="Safari">Safari</SelectItem>
            <SelectItem value="Firefox">Firefox</SelectItem>
            <SelectItem value="Edge">Edge</SelectItem>
            <SelectItem value="Opera">Opera</SelectItem>
            <SelectItem value="Samsung Internet">Samsung Internet</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={params.platform || '_all'}
          onValueChange={(v) =>
            onParamsChange({ platform: v === '_all' ? undefined : v, page: 1 })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Platforms</SelectItem>
            <SelectItem value="Windows">Windows</SelectItem>
            <SelectItem value="OS X">macOS</SelectItem>
            <SelectItem value="iOS">iOS</SelectItem>
            <SelectItem value="AndroidOS">Android</SelectItem>
            <SelectItem value="Linux">Linux</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Date range + country + clear */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          type="date"
          value={params.date_from || ''}
          onChange={(e) =>
            onParamsChange({ date_from: e.target.value || undefined, page: 1 })
          }
          className="w-[160px]"
          max={params.date_to}
        />
        <span className="text-sm text-muted-foreground">to</span>
        <Input
          type="date"
          value={params.date_to || ''}
          onChange={(e) =>
            onParamsChange({ date_to: e.target.value || undefined, page: 1 })
          }
          className="w-[160px]"
          min={params.date_from}
        />

        <Input
          placeholder="Country (e.g. Nigeria)"
          value={params.country || ''}
          onChange={(e) =>
            onParamsChange({ country: e.target.value || undefined, page: 1 })
          }
          className="w-[180px]"
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
