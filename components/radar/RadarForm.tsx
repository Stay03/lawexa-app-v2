'use client';

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
  RADAR_LIMITS,
  applyRadarServerErrors,
  buildRadarPayload,
  emptyRadarFormValues,
  radarFormSchema,
  radarFormValuesFromRadar,
  type RadarFormValues,
} from '@/lib/utils/radar-validation';
import type { CreateRadarPayload, Radar } from '@/types/radar';

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

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Shared create/edit radar form. The payload builder always emits every
 * perimeter array in full so PATCH wholesale-replace semantics can never
 * silently wipe data.
 */
function RadarForm({
  mode,
  radar,
  isSubmitting,
  submitLabel,
  onSubmit,
}: RadarFormProps) {
  const userEmail = useAuthStore((s) => s.user?.email);

  const form = useForm<RadarFormValues>({
    resolver: zodResolver(radarFormSchema),
    defaultValues: radar
      ? radarFormValuesFromRadar(radar)
      : emptyRadarFormValues(Intl.DateTimeFormat().resolvedOptions().timeZone),
  });

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
                <FormLabel>Description (optional)</FormLabel>
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
          title="Schedule"
          description="How often the agent investigates. Every scan uses one AI message."
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
          title="Watch scope"
          description="Jurisdictions, topics, and keywords that focus the investigation."
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
                <FormLabel>Topics</FormLabel>
                <FormControl>
                  <FreeTextChipsField
                    value={field.value}
                    onChange={field.onChange}
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
                <FormLabel>Keywords</FormLabel>
                <FormControl>
                  <FreeTextChipsField
                    value={field.value}
                    onChange={field.onChange}
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
          title="Pinned sources"
          description="URLs the agent must check on every scan."
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
