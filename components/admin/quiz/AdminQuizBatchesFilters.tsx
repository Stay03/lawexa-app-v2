'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type {
  AdminQuizBatchListParams,
  QuizBatchStatus,
  QuizSourceMode,
} from '@/types/admin-quiz';

const ALL = 'all';

interface AdminQuizBatchesFiltersProps {
  params: AdminQuizBatchListParams;
  onChange: (updates: Partial<AdminQuizBatchListParams>) => void;
}

export function AdminQuizBatchesFilters({
  params,
  onChange,
}: AdminQuizBatchesFiltersProps) {
  const hasFilters = !!(
    params.status ||
    params.source_mode ||
    params.date_from ||
    params.date_to
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <FilterSelect
        label="Status"
        value={params.status ?? ALL}
        onValueChange={(v) =>
          onChange({ status: v === ALL ? undefined : (v as QuizBatchStatus) })
        }
        options={[
          { value: ALL, label: 'All statuses' },
          { value: 'queued', label: 'Queued' },
          { value: 'running', label: 'Running' },
          { value: 'completed', label: 'Completed' },
          { value: 'failed', label: 'Failed' },
          { value: 'skipped', label: 'Skipped' },
        ]}
      />
      <FilterSelect
        label="Source"
        value={params.source_mode ?? ALL}
        onValueChange={(v) =>
          onChange({ source_mode: v === ALL ? undefined : (v as QuizSourceMode) })
        }
        options={[
          { value: ALL, label: 'Any' },
          { value: 'content', label: 'Content' },
          { value: 'transcript', label: 'Transcript' },
        ]}
      />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          type="date"
          className="h-9 w-full sm:w-[150px]"
          value={params.date_from ?? ''}
          onChange={(e) => onChange({ date_from: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          className="h-9 w-full sm:w-[150px]"
          value={params.date_to ?? ''}
          onChange={(e) => onChange({ date_to: e.target.value || undefined })}
        />
      </div>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              status: undefined,
              source_mode: undefined,
              date_from: undefined,
              date_to: undefined,
            })
          }
        >
          Clear
        </Button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-9 w-full sm:w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
