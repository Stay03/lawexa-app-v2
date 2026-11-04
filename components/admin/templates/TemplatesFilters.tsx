'use client';

import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AdminTemplateFacets, AdminTemplateListParams, AdminTemplateStatus } from '@/types/admin-templates';
import { STATUS_LABELS, STATUS_ORDER } from './template-model';

const ALL = '_all';

/**
 * Search and the four filters: status, and the practice areas, document
 * types and countries already in use (the server's facets), in the admin
 * pages' filter row (AdminFileFilters).
 */
export function TemplatesFilters({
  params,
  facets,
  searchValue,
  onSearchChange,
  onParamsChange,
}: {
  params: AdminTemplateListParams;
  facets: AdminTemplateFacets | undefined;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onParamsChange: (next: Partial<AdminTemplateListParams>) => void;
}) {
  const active = Boolean(params.status || params.practice_area || params.document_type || params.country_id || searchValue);

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative w-full sm:w-[260px]">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-9"
          aria-label="Search templates"
        />
      </div>

      <Select
        value={params.status ?? ALL}
        onValueChange={(value) => onParamsChange({ status: value === ALL ? undefined : (value as AdminTemplateStatus), page: 1 })}
      >
        <SelectTrigger className="w-[140px]" aria-label="Status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUS_ORDER.map((status) => (
            <SelectItem key={status} value={status}>
              {STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.practice_area ?? ALL}
        onValueChange={(value) => onParamsChange({ practice_area: value === ALL ? undefined : value, page: 1 })}
      >
        <SelectTrigger className="w-[180px]" aria-label="Practice area">
          <SelectValue placeholder="Practice area" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All practice areas</SelectItem>
          {(facets?.practice_areas ?? []).map((area) => (
            <SelectItem key={area} value={area}>
              {area}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.document_type ?? ALL}
        onValueChange={(value) => onParamsChange({ document_type: value === ALL ? undefined : value, page: 1 })}
      >
        <SelectTrigger className="w-[180px]" aria-label="Document type">
          <SelectValue placeholder="Document type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All document types</SelectItem>
          {(facets?.document_types ?? []).map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.country_id ? String(params.country_id) : ALL}
        onValueChange={(value) => onParamsChange({ country_id: value === ALL ? undefined : Number(value), page: 1 })}
      >
        <SelectTrigger className="w-[170px]" aria-label="Country">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All countries</SelectItem>
          {(facets?.countries ?? []).map((country) => (
            <SelectItem key={country.id} value={String(country.id)}>
              {country.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {active ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1"
          onClick={() => {
            onSearchChange('');
            onParamsChange({ status: undefined, practice_area: undefined, document_type: undefined, country_id: undefined, search: undefined, page: 1 });
          }}
        >
          <X className="size-4" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
