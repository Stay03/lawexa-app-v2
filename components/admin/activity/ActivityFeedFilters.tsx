'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, X } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { ACTION_GROUPS } from './action-meta';
import { FacetSelect } from './FacetSelect';
import type {
  ActivityFacets,
  ActivityFeedParams,
  ActivityStatus,
} from '@/types/admin-activity';

export type FilterState = Omit<ActivityFeedParams, 'cursor' | 'per_page'>;

interface ActivityFeedFiltersProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
  facets?: ActivityFacets;
  facetsLoading?: boolean;
}

export function ActivityFeedFilters({
  value,
  onChange,
  facets,
  facetsLoading,
}: ActivityFeedFiltersProps) {
  const [searchInput, setSearchInput] = useState(value.search ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    if (debouncedSearch !== (value.search ?? '')) {
      onChange({ ...value, search: debouncedSearch || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    setSearchInput(value.search ?? '');
  }, [value.search]);

  const selectedActions = value.action ?? [];

  function toggleAction(action: string) {
    const next = selectedActions.includes(action)
      ? selectedActions.filter((a) => a !== action)
      : [...selectedActions, action];
    onChange({ ...value, action: next.length ? next : undefined });
  }

  function patch(partial: FilterState) {
    onChange({ ...value, ...partial });
  }

  const activeCount = [
    value.action?.length,
    value.status,
    value.is_bot !== undefined,
    value.country,
    value.university,
    value.law_school,
    value.profession,
    value.user_id,
    value.subject_type,
    value.ip_address,
    value.device_id,
    value.date_from,
    value.date_to,
  ].filter(Boolean).length;

  const countryOptions =
    facets?.countries.map((c) => ({
      value: c.code || c.value,
      label: c.value,
      hint: c.code ?? undefined,
      count: c.count,
    })) ?? [];

  const universityOptions =
    facets?.universities.map((u) => ({ value: u.value, count: u.count })) ?? [];
  const lawSchoolOptions =
    facets?.law_schools.map((s) => ({ value: s.value, count: s.count })) ?? [];
  const professionOptions =
    facets?.professions.map((p) => ({ value: p.value, count: p.count })) ?? [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search user name or email"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-[240px]"
      />

      <Select
        value={value.status ?? 'any'}
        onValueChange={(v) =>
          patch({ status: v === 'any' ? undefined : (v as ActivityStatus) })
        }
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any status</SelectItem>
          <SelectItem value="success">Success</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={
          value.is_bot === undefined ? 'any' : value.is_bot ? 'bots' : 'humans'
        }
        onValueChange={(v) =>
          patch({
            is_bot: v === 'any' ? undefined : v === 'bots',
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Humans + bots</SelectItem>
          <SelectItem value="humans">Real users</SelectItem>
          <SelectItem value="bots">Bots only</SelectItem>
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Actions
            {selectedActions.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {selectedActions.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <div className="max-h-[360px] overflow-y-auto p-3 space-y-3">
            {ACTION_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.actions.map((action) => (
                    <label
                      key={action}
                      className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-accent"
                    >
                      <Checkbox
                        checked={selectedActions.includes(action)}
                        onCheckedChange={() => toggleAction(action)}
                      />
                      <span>{action}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {selectedActions.length > 0 && (
            <div className="border-t p-2">
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                onClick={() => patch({ action: undefined })}
              >
                Clear actions
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-1">
        <Input
          type="date"
          value={value.date_from ?? ''}
          onChange={(e) => patch({ date_from: e.target.value || undefined })}
          className="w-[145px]"
        />
        <span className="text-muted-foreground text-xs">→</span>
        <Input
          type="date"
          value={value.date_to ?? ''}
          onChange={(e) => patch({ date_to: e.target.value || undefined })}
          className="w-[145px]"
        />
      </div>

      <FacetSelect
        placeholder="Country"
        value={value.country ?? null}
        options={countryOptions}
        onChange={(v) => patch({ country: v ?? undefined })}
        isLoading={facetsLoading}
        allowFreeText={false}
        width="w-[150px]"
      />

      <FacetSelect
        placeholder="University"
        value={value.university ?? null}
        options={universityOptions}
        onChange={(v) => patch({ university: v ?? undefined })}
        isLoading={facetsLoading}
        width="w-[180px]"
      />

      <FacetSelect
        placeholder="Law school"
        value={value.law_school ?? null}
        options={lawSchoolOptions}
        onChange={(v) => patch({ law_school: v ?? undefined })}
        isLoading={facetsLoading}
        width="w-[170px]"
      />

      <FacetSelect
        placeholder="Profession"
        value={value.profession ?? null}
        options={professionOptions}
        onChange={(v) => patch({ profession: v ?? undefined })}
        isLoading={facetsLoading}
        width="w-[150px]"
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            More filters
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] space-y-3" align="end">
          <div className="space-y-1">
            <label className="text-xs font-medium">IP address</label>
            <Input
              placeholder="203.0.113.10"
              value={value.ip_address ?? ''}
              onChange={(e) => patch({ ip_address: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Device ID</label>
            <Input
              value={value.device_id ?? ''}
              onChange={(e) => patch({ device_id: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">User ID</label>
            <Input
              type="number"
              value={value.user_id ?? ''}
              onChange={(e) =>
                patch({
                  user_id: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Subject type</label>
              <Input
                placeholder="case"
                value={value.subject_type ?? ''}
                onChange={(e) =>
                  patch({ subject_type: e.target.value || undefined })
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Subject ID</label>
              <Input
                type="number"
                value={value.subject_id ?? ''}
                onChange={(e) =>
                  patch({
                    subject_id: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({})}
          className="gap-1"
        >
          <X className="h-3.5 w-3.5" /> Clear all
        </Button>
      )}
    </div>
  );
}
