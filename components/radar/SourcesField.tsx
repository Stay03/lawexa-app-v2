'use client';

import { useFieldArray, type Control } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { RADAR_LIMITS, type RadarFormValues } from '@/lib/utils/radar-validation';

interface SourcesFieldProps {
  control: Control<RadarFormValues>;
}

/**
 * Pinned source URLs the agent must check on every scan, each with an
 * optional label.
 */
function SourcesField({ control }: SourcesFieldProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'sources' });

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-start gap-2">
          <FormField
            control={control}
            name={`sources.${index}.url`}
            render={({ field: urlField }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input
                    placeholder="https://example.com/enforcement-actions"
                    inputMode="url"
                    {...urlField}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`sources.${index}.label`}
            render={({ field: labelField }) => (
              <FormItem className="w-36 sm:w-44">
                <FormControl>
                  <Input placeholder="Label (optional)" {...labelField} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => remove(index)}
            aria-label="Remove source"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      {fields.length < RADAR_LIMITS.sources && (
        <button
          type="button"
          onClick={() => append({ url: '', label: '' })}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Plus className="size-3" />
          Add source
        </button>
      )}
    </div>
  );
}

export { SourcesField };
