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
import { SWEEP_META } from './sweeps';
import type {
  CaseEnrichmentsParams,
  EnrichmentStatus,
  EnrichmentSweep,
  EnrichmentTrigger,
} from '@/types/admin-case-enrichments';

interface EnrichmentFiltersProps {
  params: CaseEnrichmentsParams;
  /**
   * The sweep filters the API has, read from its summary, in display order. A
   * toggle for one it lacks would list every run under a sweep's note.
   */
  availableSweeps: EnrichmentSweep[];
  /**
   * True while a sweep in the URL waits for the summary. Until it lands the
   * page cannot tell whether the sweep applies, so what the controls show can
   * still change.
   */
  disabled?: boolean;
  onParamsChange: (updates: Partial<CaseEnrichmentsParams>) => void;
}

const STATUSES: EnrichmentStatus[] = ['running', 'completed', 'partial', 'failed', 'skipped'];
const TRIGGERS: EnrichmentTrigger[] = ['ingest', 'backfill', 'manual', 'resume'];
const ALL = 'all';

export function EnrichmentFilters({
  params,
  availableSweeps,
  disabled = false,
  onParamsChange,
}: EnrichmentFiltersProps) {
  const activeSweep =
    params.sweep && availableSweeps.includes(params.sweep) ? SWEEP_META[params.sweep] : undefined;
  const oneCase = params.case_id !== undefined;
  const hasActiveFilters =
    !!params.status || !!params.trigger || !!params.unmapped_outcomes || !!activeSweep || oneCase;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {/* Status. Every row of a sweep list is partial, so while one is on the
            control reads Partial and cannot be changed. */}
        <Select
          value={params.sweep ? 'partial' : (params.status ?? ALL)}
          disabled={disabled || !!params.sweep}
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
          disabled={disabled}
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

        {/* Unmapped outcomes. A sweep list does not combine with it, so while a
            sweep is on the toggle is off and cannot be turned on. */}
        <Button
          type="button"
          variant={params.unmapped_outcomes ? 'default' : 'outline'}
          size="sm"
          className={cn('h-9 gap-1.5')}
          aria-pressed={!!params.unmapped_outcomes}
          disabled={disabled || !!params.sweep}
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

        {/* Sweep states, only those the API has */}
        {availableSweeps.map((sweep) => {
          const meta = SWEEP_META[sweep];
          const on = params.sweep === sweep;
          const Icon = meta.icon;
          return (
            <Button
              key={sweep}
              type="button"
              variant={on ? 'default' : 'outline'}
              size="sm"
              className="h-9 gap-1.5"
              aria-pressed={on}
              disabled={disabled}
              onClick={() =>
                // Status and Unmapped outcomes are cleared both ways, so a
                // hand-edited ?status= or ?unmapped_outcomes= does not come
                // back when the sweep goes off.
                onParamsChange({
                  sweep: on ? undefined : sweep,
                  status: undefined,
                  unmapped_outcomes: undefined,
                  page: 1,
                })
              }
            >
              <Icon className="h-4 w-4" />
              {meta.label}
            </Button>
          );
        })}

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1 text-muted-foreground"
            disabled={disabled}
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

      {activeSweep && <p className="text-xs text-muted-foreground">{activeSweep.note}</p>}
      {/* case_id arrives from a link, with no control of its own, so the list
          says it is narrowed and Clear widens it again. */}
      {oneCase && (
        <p className="text-xs text-muted-foreground">Runs of case #{params.case_id} only.</p>
      )}
    </div>
  );
}
