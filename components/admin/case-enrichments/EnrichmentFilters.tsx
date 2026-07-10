'use client';

import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  CaseEnrichmentsParams,
  EnrichmentStatus,
  EnrichmentTrigger,
} from '@/types/admin-case-enrichments';

interface EnrichmentFiltersProps {
  params: CaseEnrichmentsParams;
  onParamsChange: (updates: Partial<CaseEnrichmentsParams>) => void;
}

const STATUSES: EnrichmentStatus[] = ['running', 'completed', 'failed', 'skipped'];
const TRIGGERS: EnrichmentTrigger[] = ['ingest', 'backfill', 'manual'];
const ALL = 'all';

export function EnrichmentFilters({ params, onParamsChange }: EnrichmentFiltersProps) {
  const hasActiveFilters =
    !!params.status || !!params.trigger || !!params.unmapped_outcomes;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status */}
      <Select
        value={params.status ?? ALL}
        onValueChange={(value) =>
          onParamsChange({
            status: value === ALL ? undefined : (value as EnrichmentStatus),
            page: 1,
          })
        }
      >
        <SelectTrigger className="h-9 w-[160px] capitalize">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Trigger */}
      <Select
        value={params.trigger ?? ALL}
        onValueChange={(value) =>
          onParamsChange({
            trigger: value === ALL ? undefined : (value as EnrichmentTrigger),
            page: 1,
          })
        }
      >
        <SelectTrigger className="h-9 w-[160px] capitalize">
          <SelectValue placeholder="Trigger" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All triggers</SelectItem>
          {TRIGGERS.map((t) => (
            <SelectItem key={t} value={t} className="capitalize">
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Unmapped outcomes toggle */}
      <Button
        type="button"
        variant={params.unmapped_outcomes ? 'default' : 'outline'}
        size="sm"
        className={cn('h-9 gap-1.5')}
        onClick={() =>
          onParamsChange({
            unmapped_outcomes: params.unmapped_outcomes ? undefined : true,
            page: 1,
          })
        }
      >
        <AlertTriangle className="h-4 w-4" />
        Unmapped outcomes
      </Button>

      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 gap-1 text-muted-foreground"
          onClick={() =>
            onParamsChange({
              status: undefined,
              trigger: undefined,
              unmapped_outcomes: undefined,
              page: 1,
            })
          }
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
