'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CasePrinciplesParams,
  PrincipleType,
} from '@/types/admin-case-principles';

interface PrincipleReviewFiltersProps {
  params: CasePrinciplesParams;
  onParamsChange: (updates: Partial<CasePrinciplesParams>) => void;
}

const ALL = 'all';
const TYPES: PrincipleType[] = ['ratio', 'obiter'];

/** Tri-state review filter: Unreviewed (default) | Reviewed | All. */
type ReviewView = 'unreviewed' | 'reviewed' | 'all';

function reviewViewOf(reviewed: boolean | undefined): ReviewView {
  if (reviewed === undefined) return 'all';
  return reviewed ? 'reviewed' : 'unreviewed';
}

export function PrincipleReviewFilters({
  params,
  onParamsChange,
}: PrincipleReviewFiltersProps) {
  const view = reviewViewOf(params.reviewed);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Review state segmented control */}
      <div className="inline-flex rounded-lg border p-0.5">
        {(
          [
            { key: 'unreviewed', label: 'Unreviewed', reviewed: false },
            { key: 'reviewed', label: 'Reviewed', reviewed: true },
            { key: 'all', label: 'All', reviewed: undefined },
          ] as { key: ReviewView; label: string; reviewed: boolean | undefined }[]
        ).map((opt) => (
          <Button
            key={opt.key}
            type="button"
            variant={view === opt.key ? 'default' : 'ghost'}
            size="sm"
            className="h-8"
            onClick={() => onParamsChange({ reviewed: opt.reviewed, page: 1 })}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Type */}
      <Select
        value={params.type ?? ALL}
        onValueChange={(value) =>
          onParamsChange({
            type: value === ALL ? undefined : (value as PrincipleType),
            page: 1,
          })
        }
      >
        <SelectTrigger className="h-9 w-[150px] capitalize">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All types</SelectItem>
          {TYPES.map((t) => (
            <SelectItem key={t} value={t} className="capitalize">
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
