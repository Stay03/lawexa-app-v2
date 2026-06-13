'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FreeTextChipsField } from './FreeTextChipsField';
import { JurisdictionsField } from './JurisdictionsField';
import { RadarReviewDialog } from './RadarReviewDialog';
import { SchedulePicker } from './SchedulePicker';
import { SourcesField } from './SourcesField';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  findDefaultJurisdiction,
  useJurisdictions,
} from '@/lib/hooks/useJurisdictions';
import {
  RADAR_LIMITS,
  applyRadarServerErrors,
  buildRadarPayload,
  emptyRadarFormValues,
  radarFormSchema,
  radarFormValuesFromRadar,
  type RadarFormValues,
} from '@/lib/utils/radar-validation';
import type { CreateRadarPayload, Radar } from '@/types/radar';

// Matches the chat jurisdiction default: profile country, else Nigeria.
const DEFAULT_JURISDICTION_FALLBACK_SLUG = 'nigeria';

export interface RadarFormHelpers {
  /** Map a 422 error bag onto form fields; returns false when nothing matched. */
  applyServerErrors: (errors: Record<string, string[]>) => boolean;
}

interface RadarFormProps {
  mode: 'create' | 'edit';
  radar?: Radar;
  isSubmitting: boolean;
  submitLabel: string;
  onSubmit: (payload: CreateRadarPayload, helpers: RadarFormHelpers) => void;
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium">{children}</p>;
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function hasAdvancedValues(values: RadarFormValues): boolean {
  return (
    values.description.trim().length > 0 ||
    values.instructions.trim().length > 0 ||
    values.keywords.length > 0 ||
    values.sources.length > 0
  );
}

/**
 * The radar form, built around the 80% path: name it, say what to watch,
 * pick a schedule, create. Everything else — description, keywords, pinned
 * sources, watched entities, agent instructions, email delivery — lives in
 * a single collapsed "More options" group with a configured-count badge.
 * The payload builder always emits every perimeter array in full so PATCH
 * wholesale-replace semantics can never silently wipe data.
 */
function RadarForm({
  mode,
  radar,
  isSubmitting,
  submitLabel,
  onSubmit,
}: RadarFormProps) {
  const userEmail = useAuthStore((s) => s.user?.email);
  const profileCountry = useAuthStore((s) => s.user?.profile?.country);
  const { data: jurisdictions } = useJurisdictions();

  const form = useForm<RadarFormValues>({
    resolver: zodResolver(radarFormSchema),
    defaultValues: radar
      ? radarFormValuesFromRadar(radar)
      : emptyRadarFormValues(Intl.DateTimeFormat().resolvedOptions().timeZone),
  });

  // Editing a radar that already uses advanced fields starts expanded.
  const [moreOpen, setMoreOpen] = useState(
    () => radar !== undefined && hasAdvancedValues(radarFormValuesFromRadar(radar))
  );

  // Pre-fill the user's own jurisdiction on create, once the list is
  // available — applied a single time so removing it deliberately sticks.
  const jurisdictionPrefilled = useRef(mode === 'edit');
  useEffect(() => {
    if (jurisdictionPrefilled.current || !jurisdictions) return;
    jurisdictionPrefilled.current = true;
    if (form.getValues('jurisdictions').length > 0) return;
    const match =
      findDefaultJurisdiction(jurisdictions, profileCountry) ??
      jurisdictions.find(
        (jurisdiction) =>
          jurisdiction.slug === DEFAULT_JURISDICTION_FALLBACK_SLUG
      );
    if (match) {
      form.setValue('jurisdictions', [match.slug]);
    }
  }, [jurisdictions, profileCountry, form]);

  const [description, instructions, keywords, sources] = form.watch([
    'description',
    'instructions',
    'keywords',
    'sources',
  ]);

  const configuredCount =
    (description.trim() ? 1 : 0) +
    (instructions.trim() ? 1 : 0) +
    (keywords.length > 0 ? 1 : 0) +
    (sources.length > 0 ? 1 : 0);

  // On create we confirm a summary before saving; edits save straight away.
  // `pendingValues` doubles as the review dialog's open state. Note that
  // `entities` is intentionally still carried in the form values (and the
  // payload) so editing a radar never silently clears entities the backend
  // holds — the field is simply no longer surfaced in the UI.
  const [pendingValues, setPendingValues] = useState<RadarFormValues | null>(
    null
  );

  const submit = (values: RadarFormValues) => {
    onSubmit(buildRadarPayload(values, { includeFirstScan: mode === 'create' }), {
      applyServerErrors: (errors) => applyRadarServerErrors(form.setError, errors),
    });
  };

  const handleSubmit = (values: RadarFormValues) => {
    if (mode === 'create') {
      setPendingValues(values);
      return;
    }
    submit(values);
  };

  const handleConfirm = () => {
    if (!pendingValues) return;
    const values = pendingValues;
    setPendingValues(null);
    submit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-7">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. NDPA Enforcement Updates — Nigeria"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <GroupLabel>What to track</GroupLabel>
          <div className="grid items-start gap-3 sm:grid-cols-[2fr_3fr]">
            <FormField
              control={form.control}
              name="jurisdictions"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <SubLabel>Jurisdictions</SubLabel>
                  <FormControl>
                    <JurisdictionsField
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="topics"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <SubLabel>Topics</SubLabel>
                  <FormControl>
                    <FreeTextChipsField
                      value={field.value}
                      onChange={field.onChange}
                      itemNoun="topic"
                      placeholder="e.g. NDPA enforcement"
                      maxItems={RADAR_LIMITS.topics}
                      maxItemLength={RADAR_LIMITS.topicLength}
                      aria-label="Topics"
                    />
                  </FormControl>
                  <SubLabel>
                    Examples: data protection enforcement, fintech licensing,
                    tax appeals, mergers &amp; acquisitions
                  </SubLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-2">
          <GroupLabel>Schedule</GroupLabel>
          <FormField
            control={form.control}
            name="schedule_cron"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <SchedulePicker
                    value={{
                      cron: field.value,
                      timezone: form.watch('timezone'),
                    }}
                    onChange={(next) => {
                      field.onChange(next.cron);
                      form.setValue('timezone', next.timezone, {
                        shouldDirty: true,
                      });
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Collapsible
          open={moreOpen}
          onOpenChange={setMoreOpen}
          className="rounded-xl border"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40"
            >
              <span className="flex items-center gap-2">
                More options
                {configuredCount > 0 && (
                  <Badge variant="secondary">{configuredCount} set</Badge>
                )}
              </span>
              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  moreOpen && 'rotate-180'
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-5 border-t px-4 py-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <SubLabel>Description</SubLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="A short note on what this radar tracks"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="keywords"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <SubLabel>Keywords — exact phrases the radar should detect</SubLabel>
                  <FormControl>
                    <FreeTextChipsField
                      value={field.value}
                      onChange={field.onChange}
                      itemNoun="keyword"
                      placeholder="e.g. NDPC, data protection fine"
                      maxItems={RADAR_LIMITS.keywords}
                      maxItemLength={RADAR_LIMITS.keywordLength}
                      aria-label="Keywords"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sources"
              render={() => (
                <FormItem className="space-y-1.5">
                  <SubLabel>Pinned sources — URLs checked on every scan</SubLabel>
                  <SourcesField control={form.control} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <SubLabel>Custom instructions</SubLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="e.g. Prioritise enforcement actions and fines over policy commentary."
                      maxLength={RADAR_LIMITS.instructions}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </CollapsibleContent>
        </Collapsible>

        <div className="divide-y rounded-xl border">
          <FormField
            control={form.control}
            name="email_channel"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4 space-y-0 px-4 py-3">
                <div>
                  <FormLabel className="text-sm font-medium">
                    Email reports
                  </FormLabel>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {userEmail ? `Sent to ${userEmail} — reports` : 'Reports'}{' '}
                    always appear in-app and in your notifications.
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {mode === 'create' && (
            <FormField
              control={form.control}
              name="first_scan"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4 space-y-0 px-4 py-3">
                  <div>
                    <FormLabel className="text-sm font-medium">
                      Run first scan now
                    </FormLabel>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Generate a radar report now
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>

      <RadarReviewDialog
        values={pendingValues}
        jurisdictions={jurisdictions}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirm}
        onCancel={() => setPendingValues(null)}
      />
    </Form>
  );
}

export { RadarForm };
