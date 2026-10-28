'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AdminAiSkillsParams } from '@/types/admin-ai';

interface AiSkillFiltersProps {
  params: AdminAiSkillsParams;
  onParamsChange: (params: Partial<AdminAiSkillsParams>) => void;
}

/** Search, load mode, status and page size, as on the tools list. */
export function AiSkillFilters({ params, onParamsChange }: AiSkillFiltersProps) {
  const [search, setSearch] = useState(params.search ?? '');

  // The search goes into the address a moment after typing stops.
  useEffect(() => {
    const current = params.search ?? '';
    if (search === current) return;
    const timer = window.setTimeout(() => onParamsChange({ search: search || undefined, page: 1 }), 300);
    return () => window.clearTimeout(timer);
  }, [search, params.search, onParamsChange]);

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative sm:w-[240px]">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search skills"
          aria-label="Search skills"
          className="pl-8"
        />
      </div>

      <Select
        value={params.load_mode ?? 'all'}
        onValueChange={(value) =>
          onParamsChange({
            load_mode: value === 'all' ? undefined : (value as AdminAiSkillsParams['load_mode']),
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[160px]" aria-label="Load mode">
          <SelectValue placeholder="Load mode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All load modes</SelectItem>
          <SelectItem value="on_demand">On demand</SelectItem>
          <SelectItem value="always_on">Always on</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={params.active_only === undefined ? 'all' : params.active_only ? 'active' : 'inactive'}
        onValueChange={(value) =>
          onParamsChange({ active_only: value === 'all' ? undefined : value === 'active', page: 1 })
        }
      >
        <SelectTrigger className="w-[130px]" aria-label="Status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={String(params.per_page || 15)}
        onValueChange={(value) => onParamsChange({ per_page: parseInt(value), page: 1 })}
      >
        <SelectTrigger className="w-[112px]" aria-label="Per page">
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
