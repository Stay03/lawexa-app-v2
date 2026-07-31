'use client';

import { useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { RADAR_LIMITS, type RadarSourceValue } from './form-model';

/**
 * SourcesField — pinned URLs the agent checks on every scan, each with an
 * optional label. Controlled rows (no field-array library): the parent owns
 * the array; each row edits its index. Per-row URL errors arrive from the
 * form's submit validation and render UNDER the offending row — the honest
 * error mapping the study requires, not a group-level shrug.
 */
export function SourcesField({
  value,
  onChange,
  errors,
}: {
  value: RadarSourceValue[];
  onChange: (value: RadarSourceValue[]) => void;
  /** Row-indexed messages from `validateRadarForm`. */
  errors: Record<number, string>;
}) {
  const uid = useId();

  const updateRow = (index: number, patch: Partial<RadarSourceValue>) => {
    onChange(
      value.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  };

  const removeRow = (index: number) => {
    onChange(value.filter((_, rowIndex) => rowIndex !== index));
  };

  return (
    <div className="space-y-3">
      {value.map((row, index) => {
        const error = errors[index];
        const errorId = `${uid}-source-${index}-error`;
        return (
          <div key={index} className="space-y-1">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  value={row.url}
                  onChange={(event) =>
                    updateRow(index, { url: event.target.value })
                  }
                  placeholder="https://example.com/enforcement-actions"
                  inputMode="url"
                  autoComplete="off"
                  aria-label={`Source ${index + 1} URL`}
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? errorId : undefined}
                  className={cn(error && 'border-destructive/60')}
                />
              </div>
              <div className="w-36 sm:w-44">
                <Input
                  value={row.label}
                  onChange={(event) =>
                    updateRow(index, { label: event.target.value })
                  }
                  placeholder="Label (optional)"
                  maxLength={RADAR_LIMITS.sourceLabelLength}
                  autoComplete="off"
                  aria-label={`Source ${index + 1} label`}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(index)}
                aria-label={`Remove source ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            {error ? (
              <p id={errorId} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      {value.length < RADAR_LIMITS.sources ? (
        <button
          type="button"
          onClick={() => onChange([...value, { url: '', label: '' }])}
          className={cn(
            'v2-interactive inline-flex min-h-7 items-center gap-1 rounded-full border border-dashed border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <Plus aria-hidden className="size-3" />
          Add source
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Limit of {RADAR_LIMITS.sources} pinned sources reached.
        </p>
      )}
    </div>
  );
}
