'use client';

import { AlertTriangle, CirclePause, X } from 'lucide-react';
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

const STATUSES: EnrichmentStatus[] = ['running', 'completed', 'partial', 'failed', 'skipped'];
const TRIGGERS: EnrichmentTrigger[] = ['ingest', 'backfill', 'manual', 'resume'];
const ALL = 'all';

export function EnrichmentFilters({ params, onParamsChange }: EnrichmentFiltersProps) {
  const stopped = params.sweep === 'stopped';
  const oneCase = params.case_id !== undefined;
  const hasActiveFilters =
    !!params.status || !!params.trigger || !!params.unmapped_outcomes || stopped || oneCase;

  return (
    <div className="space-y-2">
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
          aria-pressed={!!params.unmapped_outcomes}
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

        {/* Stopped toggle: partial cases the resume sweep has given up on */}
        <Button
          type="button"
          variant={stopped ? 'default' : 'outline'}
          size="sm"
          className="h-9 gap-1.5"
          aria-pressed={stopped}
          onClick={() =>
            onParamsChange({
              sweep: stopped ? undefined : 'stopped',
              page: 1,
            })
          }
        >
          <CirclePause className="h-4 w-4" />
          Stopped
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
                sweep: undefined,
                case_id: undefined,
                page: 1,
              })
            }
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {stopped && (
        <p className="text-xs text-muted-foreground">
          Partial cases the resume sweep has stopped retrying: its last 3 attempts read no
          new part. A later run that reads a part, or a changed report, clears the stop.
        </p>
      )}
      {/* case_id arrives from a link, with no control of its own, so the list
          says it is narrowed and Clear widens it again. */}
      {oneCase && (
        <p className="text-xs text-muted-foreground">Runs of case #{params.case_id} only.</p>
      )}
    </div>
  );
}
