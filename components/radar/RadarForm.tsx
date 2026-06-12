'use client';

import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { EntityPicker } from './EntityPicker';
import { FreeTextChipsField } from './FreeTextChipsField';
import { JurisdictionsField } from './JurisdictionsField';
import { SchedulePicker } from './SchedulePicker';
import { SourcesField } from './SourcesField';
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

function OptionalTag() {
  return (
    <span className="font-normal text-muted-foreground"> (optional)</span>
  );
}

function FormSection({
  title,
  description,
  optional = false,
  children,
}: {
  title: string;
  description?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">
          {title}
          {optional && <OptionalTag />}
        </h3>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Shared create/edit radar form, ordered by importance: what to call it,
 * what to watch, when to scan, then the optional extras. The payload builder
 * always emits every perimeter array in full so PATCH wholesale-replace
 * semantics can never silently wipe data.
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

  const instructionsLength = form.watch('instructions').length;

  const handleSubmit = (values: RadarFormValues) => {
    onSubmit(buildRadarPayload(values, { includeFirstScan: mode === 'create' }), {
      applyServerErrors: (errors) => applyRadarServerErrors(form.setError, errors),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <FormSection
          title="Basics"
          description="What this radar is called and what it watches for."
        >
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
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Description
                  <OptionalTag />
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="A short note on what this radar monitors"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <Separator />

        <FormSection
          title="Watch scope"
          description="Where to look and what to look for."
        >
          <FormField
            control={form.control}
            name="jurisdictions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jurisdictions</FormLabel>
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
              <FormItem>
                <FormLabel>
                  Topics
                  <OptionalTag />
                </FormLabel>
                <FormControl>
                  <FreeTextChipsField
                    value={field.value}
                    onChange={field.onChange}
                    itemNoun="topic"
                    placeholder="e.g. NDPA enforcement"
                    maxItems={RADAR_LIMITS.topics}
                    maxItemLength={RADAR_LIMITS.topicLength}
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
              <FormItem>
                <FormLabel>
                  Keywords
                  <OptionalTag />
                </FormLabel>
                <FormControl>
                  <FreeTextChipsField
                    value={field.value}
                    onChange={field.onChange}
                    itemNoun="keyword"
                    placeholder="e.g. NDPC, data protection fine"
                    maxItems={RADAR_LIMITS.keywords}
                    maxItemLength={RADAR_LIMITS.keywordLength}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <Separator />

        <FormSection
          title="Schedule"
          description="How often the agent investigates."
        >
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
        </FormSection>

        <Separator />

        <FormSection
          title="Pinned sources"
          description="URLs the agent must check on every scan."
          optional
        >
          <FormField
            control={form.control}
            name="sources"
            render={() => (
              <FormItem>
                <SourcesField control={form.control} />
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <Separator />

        <FormSection
          title="Watched entities"
          description="Lawexa cases, statutes, courts, judges, or notes to keep an eye on."
          optional
        >
          <FormField
            control={form.control}
            name="entities"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <EntityPicker value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <Separator />

        <FormSection
          title="Agent instructions"
          description="Free-form guidance for the investigator — scopes, priorities, what to ignore."
          optional
        >
          <FormField
            control={form.control}
            name="instructions"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    rows={6}
                    placeholder="e.g. Prioritise enforcement actions and fines over policy commentary. Flag anything involving cross-border data transfers."
                    {...field}
                  />
                </FormControl>
                <div className="flex justify-end">
                  <span className="text-xs text-muted-foreground">
                    {instructionsLength}/{RADAR_LIMITS.instructions}
                  </span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <Separator />

        <FormSection
          title="Notifications"
          description="Where reports are delivered."
        >
          <div className="flex items-start gap-3">
            <Checkbox checked disabled className="mt-0.5" />
            <div>
              <p className="text-sm font-medium">In-app</p>
              <p className="text-sm text-muted-foreground">
                Always on — reports appear in your notifications and the radar
                inbox.
              </p>
            </div>
          </div>
          <FormField
            control={form.control}
            name="email_channel"
            render={({ field }) => (
              <FormItem className="flex items-start gap-3 space-y-0">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                </FormControl>
                <div>
                  <FormLabel className="text-sm font-medium">Email</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    {userEmail
                      ? `Sent to ${userEmail}`
                      : 'Sent to your account email address'}
                  </p>
                </div>
              </FormItem>
            )}
          />
        </FormSection>

        {mode === 'create' && (
          <>
            <Separator />
            <FormField
              control={form.control}
              name="first_scan"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3 space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-0.5"
                    />
                  </FormControl>
                  <div>
                    <FormLabel className="text-sm font-medium">
                      Run the first scan immediately
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Uses 1 AI message. Otherwise the first report arrives on
                      schedule.
                    </p>
                  </div>
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export { RadarForm };
