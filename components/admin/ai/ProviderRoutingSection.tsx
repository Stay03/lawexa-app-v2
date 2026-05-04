'use client';

import { useState, KeyboardEvent } from 'react';
import { useFormContext } from 'react-hook-form';
import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const SLUG_MAX_LENGTH = 50;

interface ProviderRoutingSectionProps {
  visible: boolean;
}

export function ProviderRoutingSection({
  visible,
}: ProviderRoutingSectionProps) {
  const form = useFormContext();
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  if (!visible) return null;

  const addSlug = (current: string[]) => {
    const cleaned = draft.trim().toLowerCase();
    if (!cleaned) {
      setDraftError('Provider slug cannot be empty.');
      return null;
    }
    if (cleaned.length > SLUG_MAX_LENGTH) {
      setDraftError(`Provider slug must be ≤ ${SLUG_MAX_LENGTH} characters.`);
      return null;
    }
    if (current.includes(cleaned)) {
      setDraft('');
      setDraftError(null);
      return null;
    }
    setDraft('');
    setDraftError(null);
    return [...current, cleaned];
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold leading-none">
          Provider Routing
        </h3>
        <p className="text-xs text-muted-foreground">
          Pin which upstream OpenRouter providers serve this model. Maps to
          OpenRouter&apos;s{' '}
          <code className="font-mono text-[11px]">provider</code> parameter.
        </p>
      </div>

      <FormField
        control={form.control}
        name="provider_routing.order"
        render={({ field }) => {
          const value: string[] = Array.isArray(field.value) ? field.value : [];
          const move = (index: number, delta: number) => {
            const next = [...value];
            const target = index + delta;
            if (target < 0 || target >= next.length) return;
            [next[index], next[target]] = [next[target], next[index]];
            field.onChange(next);
          };
          const remove = (index: number) => {
            field.onChange(value.filter((_, i) => i !== index));
          };
          const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              const next = addSlug(value);
              if (next) field.onChange(next);
              return;
            }
            if (e.key === 'Backspace' && draft === '' && value.length > 0) {
              e.preventDefault();
              field.onChange(value.slice(0, -1));
            }
          };
          const handleAddClick = () => {
            const next = addSlug(value);
            if (next) field.onChange(next);
          };

          return (
            <FormItem>
              <FormLabel>Preferred providers</FormLabel>
              <FormDescription>
                Order matters — OpenRouter tries them top-to-bottom. Free-text
                slugs (e.g. <span className="font-mono">siliconflow</span>,{' '}
                <span className="font-mono">novita</span>).
              </FormDescription>

              {value.length > 0 && (
                <ul className="space-y-1.5">
                  {value.map((slug, index) => (
                    <li
                      key={`${slug}-${index}`}
                      className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5"
                    >
                      <GripVertical
                        className="h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate font-mono text-sm">
                        {slug}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${slug} up`}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => move(index, 1)}
                        disabled={index === value.length - 1}
                        aria-label={`Move ${slug} down`}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(index)}
                        aria-label={`Remove ${slug}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2">
                <FormControl>
                  <Input
                    value={draft}
                    onChange={(e) => {
                      setDraft(e.target.value);
                      if (draftError) setDraftError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Add provider slug, then Enter"
                    className="font-mono text-sm"
                    maxLength={SLUG_MAX_LENGTH + 10}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddClick}
                  disabled={draft.trim().length === 0}
                >
                  Add
                </Button>
              </div>
              {draftError && (
                <p className="text-sm text-destructive">{draftError}</p>
              )}

              <FormMessage />
            </FormItem>
          );
        }}
      />

      <FormField
        control={form.control}
        name="provider_routing.allow_fallbacks"
        render={({ field }) => (
          <FormItem className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel className="text-sm font-medium cursor-pointer">
                  Allow fallbacks
                </FormLabel>
                <p className="text-xs text-muted-foreground">
                  If off, only the providers listed above are used.
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={!!field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    form.setValue('_allowFallbacksTouched', true, {
                      shouldDirty: true,
                    });
                  }}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
