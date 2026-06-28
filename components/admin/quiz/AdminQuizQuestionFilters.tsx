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
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type {
  AdminQuizQuestionListParams,
  QuizQuestionStatus,
  QuizSourceMode,
} from '@/types/admin-quiz';
import type { QuizDifficulty } from '@/types/quiz';

interface AdminQuizQuestionFiltersProps {
  params: AdminQuizQuestionListParams;
  onChange: (updates: Partial<AdminQuizQuestionListParams>) => void;
}

const ALL = 'all';

export function AdminQuizQuestionFilters({
  params,
  onChange,
}: AdminQuizQuestionFiltersProps) {
  const hasFilters = !!(
    params.status ||
    params.difficulty ||
    params.source_mode ||
    params.with_trashed ||
    params.date_from ||
    params.date_to
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        label="Status"
        value={params.status ?? ALL}
        onValueChange={(v) =>
          onChange({ status: v === ALL ? undefined : (v as QuizQuestionStatus) })
        }
        options={[
          { value: ALL, label: 'All statuses' },
          { value: 'approved', label: 'Approved' },
          { value: 'archived', label: 'Archived' },
        ]}
      />
      <FilterSelect
        label="Difficulty"
        value={params.difficulty ? String(params.difficulty) : ALL}
        onValueChange={(v) =>
          onChange({
            difficulty: v === ALL ? undefined : (Number(v) as QuizDifficulty),
          })
        }
        options={[
          { value: ALL, label: 'Any' },
          ...[1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: `Level ${d}` })),
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
          className="h-9 w-[150px]"
          value={params.date_from ?? ''}
          onChange={(e) => onChange({ date_from: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          className="h-9 w-[150px]"
          value={params.date_to ?? ''}
          onChange={(e) => onChange({ date_to: e.target.value || undefined })}
        />
      </div>
      <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={!!params.with_trashed}
          onCheckedChange={(c) =>
            onChange({ with_trashed: c === true ? true : undefined })
          }
        />
        Show deleted
      </label>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              status: undefined,
              difficulty: undefined,
              source_mode: undefined,
              with_trashed: undefined,
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
        <SelectTrigger className="h-9 w-[150px]">
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
