'use client';

import { useEffect, useMemo, useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, RefreshCw, Gauge } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { useAdminSettings, useUpdateAdminSettings } from '@/lib/hooks/useAdmin';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminSetting } from '@/types/admin-settings';

// ---------------------------------------------------------------------------
// Resource config — defines the three throttle cards rendered explicitly.
// Any other `limits` keys returned by the backend land in a fallback card.
// ---------------------------------------------------------------------------

interface ThrottleResource {
  prefix: 'case' | 'statute' | 'note';
  title: string;
  description: string;
  enabledKey: string;
  perMinuteKey: string;
  perHourKey: string;
}

const THROTTLE_RESOURCES: ThrottleResource[] = [
  {
    prefix: 'case',
    title: 'Case views',
    description:
      'Limit how often a single user can open case detail pages. Helps protect against scraping while leaving normal browsing untouched.',
    enabledKey: 'case_view_throttle_enabled',
    perMinuteKey: 'case_view_throttle_per_minute',
    perHourKey: 'case_view_throttle_per_hour',
  },
  {
    prefix: 'statute',
    title: 'Statute views',
    description:
      'Limit how often a single user can open statute detail pages.',
    enabledKey: 'statute_view_throttle_enabled',
    perMinuteKey: 'statute_view_throttle_per_minute',
    perHourKey: 'statute_view_throttle_per_hour',
  },
  {
    prefix: 'note',
    title: 'Note views',
    description: 'Limit how often a single user can open note detail pages.',
    enabledKey: 'note_view_throttle_enabled',
    perMinuteKey: 'note_view_throttle_per_minute',
    perHourKey: 'note_view_throttle_per_hour',
  },
];

const KNOWN_THROTTLE_KEYS = new Set<string>(
  THROTTLE_RESOURCES.flatMap((r) => [r.enabledKey, r.perMinuteKey, r.perHourKey])
);

// Statute paywall settings (backend, Aug 2 2026): the master switch and the
// excerpt size. Rendered as their own card — this is a revenue switch, not a
// throttle — and saving a change to the switch asks for confirmation first,
// because it takes effect for every free user the moment it saves.
const PAYWALL_ENABLED_KEY = 'statute_paywall_enabled';
const PAYWALL_SECTIONS_KEY = 'statute_paywall_free_sections';

const EXPLICITLY_RENDERED_KEYS = new Set<string>([
  ...KNOWN_THROTTLE_KEYS,
  PAYWALL_ENABLED_KEY,
  PAYWALL_SECTIONS_KEY,
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSettingValue(setting: AdminSetting): boolean | number | string {
  const v = setting.value;
  switch (setting.type) {
    case 'boolean':
      return v === true || v === 'true' || v === 1 || v === '1';
    case 'integer':
      return typeof v === 'number' ? v : parseInt(String(v), 10) || 0;
    case 'json':
      return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
    case 'string':
    default:
      return String(v ?? '');
  }
}

function formatLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Generic field renderer for "other limits" fallback card
// ---------------------------------------------------------------------------

interface GenericFieldProps {
  setting: AdminSetting;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
}

function GenericSettingField({ setting, control }: GenericFieldProps) {
  const label = formatLabel(setting.key);

  if (setting.type === 'boolean') {
    return (
      <FormField
        control={control}
        name={setting.key}
        render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <FormLabel className="text-sm font-medium cursor-pointer">
                {label}
              </FormLabel>
              {setting.description && (
                <FormDescription className="text-xs">
                  {setting.description}
                </FormDescription>
              )}
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
    );
  }

  if (setting.type === 'integer') {
    return (
      <FormField
        control={control}
        name={setting.key}
        render={({ field }) => (
          <FormItem className="flex items-center justify-between gap-x-6 py-3">
            <div className="space-y-0.5">
              <FormLabel className="text-sm font-medium">{label}</FormLabel>
              {setting.description && (
                <FormDescription className="text-xs">
                  {setting.description}
                </FormDescription>
              )}
            </div>
            <FormControl>
              <Input
                type="number"
                min="0"
                className="w-28 shrink-0"
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                  )
                }
              />
            </FormControl>
          </FormItem>
        )}
      />
    );
  }

  return (
    <FormField
      control={control}
      name={setting.key}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between gap-x-6 py-3">
          <div className="space-y-0.5">
            <FormLabel className="text-sm font-medium">{label}</FormLabel>
            {setting.description && (
              <FormDescription className="text-xs">
                {setting.description}
              </FormDescription>
            )}
          </div>
          <FormControl>
            <Input className="w-48 shrink-0" {...field} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Per-resource throttle card
// ---------------------------------------------------------------------------

interface ThrottleCardProps {
  resource: ThrottleResource;
  settingsByKey: Map<string, AdminSetting>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  enabled: boolean;
}

function ThrottleCard({
  resource,
  settingsByKey,
  control,
  enabled,
}: ThrottleCardProps) {
  const enabledSetting = settingsByKey.get(resource.enabledKey);
  const perMinuteSetting = settingsByKey.get(resource.perMinuteKey);
  const perHourSetting = settingsByKey.get(resource.perHourKey);

  if (!enabledSetting || !perMinuteSetting || !perHourSetting) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{resource.title}</CardTitle>
        <CardDescription>{resource.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormField
          control={control}
          name={resource.enabledKey}
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel className="text-sm font-medium cursor-pointer">
                  Throttle enabled
                </FormLabel>
                <FormDescription className="text-xs">
                  {enabledSetting.description ||
                    'Master switch for this throttle.'}
                </FormDescription>
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

        <div className="grid gap-3 sm:grid-cols-2 pt-1">
          <FormField
            control={control}
            name={resource.perMinuteKey}
            render={({ field }) => (
              <FormItem
                className={`rounded-lg border p-3 ${enabled ? '' : 'opacity-50'}`}
              >
                <FormLabel className="text-sm font-medium">
                  Per minute
                </FormLabel>
                <FormDescription className="text-xs">
                  {perMinuteSetting.description ||
                    'Max views per user per 60 seconds.'}
                </FormDescription>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    className="mt-2 w-28"
                    disabled={!enabled}
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === ''
                          ? 0
                          : parseInt(e.target.value, 10)
                      )
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={resource.perHourKey}
            render={({ field }) => (
              <FormItem
                className={`rounded-lg border p-3 ${enabled ? '' : 'opacity-50'}`}
              >
                <FormLabel className="text-sm font-medium">Per hour</FormLabel>
                <FormDescription className="text-xs">
                  {perHourSetting.description ||
                    'Max views per user per 60 minutes.'}
                </FormDescription>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    className="mt-2 w-28"
                    disabled={!enabled}
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === ''
                          ? 0
                          : parseInt(e.target.value, 10)
                      )
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Statute paywall card
// ---------------------------------------------------------------------------

interface PaywallCardProps {
  settingsByKey: Map<string, AdminSetting>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  enabled: boolean;
}

function StatutePaywallCard({ settingsByKey, control, enabled }: PaywallCardProps) {
  const enabledSetting = settingsByKey.get(PAYWALL_ENABLED_KEY);
  const sectionsSetting = settingsByKey.get(PAYWALL_SECTIONS_KEY);

  if (!enabledSetting || !sectionsSetting) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statute paywall</CardTitle>
        <CardDescription>
          When ON, free users and guests read only the first sections of a
          statute, with an upgrade card. Paid users always get the full text.
          Changes apply the moment you save.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormField
          control={control}
          name={PAYWALL_ENABLED_KEY}
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel className="text-sm font-medium cursor-pointer">
                  Paywall enabled
                </FormLabel>
                <FormDescription className="text-xs">
                  {enabledSetting.description ||
                    'The master switch. Saving a change here asks you to confirm.'}
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={PAYWALL_SECTIONS_KEY}
          render={({ field }) => (
            <FormItem
              className={`flex items-center justify-between gap-x-6 rounded-lg border p-3 ${enabled ? '' : 'opacity-50'}`}
            >
              <div className="space-y-0.5">
                <FormLabel className="text-sm font-medium">
                  Free sections
                </FormLabel>
                <FormDescription className="text-xs">
                  {sectionsSetting.description ||
                    'How many sections the free excerpt includes. Minimum 1.'}
                </FormDescription>
              </div>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  className="w-28 shrink-0"
                  disabled={!enabled}
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === '' ? 1 : parseInt(e.target.value, 10)
                    )
                  }
                />
              </FormControl>
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LimitsLoadingSkeleton() {
  return (
    <div className="max-w-3xl space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-lg border p-6 space-y-4">
          <Skeleton className="h-6 w-[160px]" />
          <Skeleton className="h-4 w-[280px]" />
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LimitsSettingsContent() {
  const limitsQuery = useAdminSettings({ group: 'limits' });

  const allSettings = useMemo(
    () => limitsQuery.data?.data || [],
    [limitsQuery.data]
  );

  const settingsByKey = useMemo(() => {
    const map = new Map<string, AdminSetting>();
    for (const s of allSettings) map.set(s.key, s);
    return map;
  }, [allSettings]);

  const otherSettings = useMemo(
    () => allSettings.filter((s) => !EXPLICITLY_RENDERED_KEYS.has(s.key)),
    [allSettings]
  );

  // Dynamic zod schema (matches billing's pattern)
  const schema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const setting of allSettings) {
      switch (setting.type) {
        case 'boolean':
          shape[setting.key] = z.boolean();
          break;
        case 'integer':
          // The paywall excerpt must include at least one section — the
          // backend enforces the same minimum.
          shape[setting.key] =
            setting.key === PAYWALL_SECTIONS_KEY
              ? z.number().int().min(1)
              : z.number().int();
          break;
        case 'string':
        case 'json':
        default:
          shape[setting.key] = z.string();
          break;
      }
    }
    return z.object(shape);
  }, [allSettings]);

  const defaultValues = useMemo(() => {
    const values: Record<string, boolean | number | string> = {};
    for (const setting of allSettings) {
      values[setting.key] = parseSettingValue(setting);
    }
    return values;
  }, [allSettings]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    if (allSettings.length > 0) {
      form.reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  // Watch the three enabled toggles to drive disabling per card
  const enabledKeys = THROTTLE_RESOURCES.map((r) => r.enabledKey);
  const watched = form.watch(enabledKeys);
  const enabledByPrefix = useMemo(() => {
    const map: Record<string, boolean> = {};
    THROTTLE_RESOURCES.forEach((r, i) => {
      map[r.prefix] = !!watched[i];
    });
    return map;
  }, [watched]);
  const paywallEnabled = !!form.watch(PAYWALL_ENABLED_KEY);

  const updateMutation = useUpdateAdminSettings();

  // A pending save that includes the paywall master switch. Saving is the
  // moment the change becomes real for every free user, so THAT is where the
  // confirmation sits — not on the toggle, which only edits the form.
  const [paywallConfirm, setPaywallConfirm] = useState<{
    changed: Record<string, string | number | boolean>;
    data: Record<string, unknown>;
    turningOn: boolean;
  } | null>(null);

  const commitSave = useCallback(
    (
      changed: Record<string, string | number | boolean>,
      data: Record<string, unknown>
    ) => {
      updateMutation.mutate(
        { settings: changed },
        {
          onSuccess: (response) => {
            toast.success(response.message || 'Settings updated successfully.');
            form.reset(data);
          },
          onError: (error) => {
            const apiError = extractApiError(error);
            toast.error(apiError.message);
            if (apiError.errors) {
              for (const [field, messages] of Object.entries(apiError.errors)) {
                const key = field.replace(/^settings\./, '');
                const message = Array.isArray(messages)
                  ? messages[0]
                  : String(messages);
                if (message) {
                  form.setError(key as never, { message });
                }
              }
            }
          },
        }
      );
    },
    [form, updateMutation]
  );

  const onSubmit = useCallback(
    (data: Record<string, unknown>) => {
      const dirtyFields = form.formState.dirtyFields;
      const changed: Record<string, string | number | boolean> = {};

      for (const key of Object.keys(dirtyFields)) {
        if (dirtyFields[key]) {
          changed[key] = data[key] as string | number | boolean;
        }
      }

      if (Object.keys(changed).length === 0) {
        toast.info('No changes to save.');
        return;
      }

      // The paywall master switch changes what every free user sees, the
      // instant it saves. Hold the save behind a confirmation.
      if (PAYWALL_ENABLED_KEY in changed) {
        setPaywallConfirm({
          changed,
          data,
          turningOn: changed[PAYWALL_ENABLED_KEY] === true,
        });
        return;
      }

      commitSave(changed, data);
    },
    [form, commitSave]
  );

  const isLoading = limitsQuery.isLoading;
  const isError = limitsQuery.isError;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Gauge className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Limits & Throttles
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Control per-user view rates for cases, statutes, and notes.
            Changes apply immediately.
          </p>
        </div>
      </div>

      {isLoading && <LimitsLoadingSkeleton />}

      {isError && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Failed to load settings.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => limitsQuery.refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && allSettings.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No limits settings found.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && allSettings.length > 0 && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="max-w-3xl space-y-6"
          >
            <StatutePaywallCard
              settingsByKey={settingsByKey}
              control={form.control}
              enabled={paywallEnabled}
            />

            {THROTTLE_RESOURCES.map((resource) => (
              <ThrottleCard
                key={resource.prefix}
                resource={resource}
                settingsByKey={settingsByKey}
                control={form.control}
                enabled={enabledByPrefix[resource.prefix]}
              />
            ))}

            {otherSettings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Other limits</CardTitle>
                  <CardDescription>
                    Additional limits-group settings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y">
                  {otherSettings.map((setting) => (
                    <GenericSettingField
                      key={setting.key}
                      setting={setting}
                      control={form.control}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 pb-8">
              <Button
                type="button"
                variant="outline"
                disabled={
                  !form.formState.isDirty || updateMutation.isPending
                }
                onClick={() => form.reset(defaultValues)}
              >
                Discard Changes
              </Button>
              <Button
                type="submit"
                disabled={
                  !form.formState.isDirty || updateMutation.isPending
                }
              >
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save changes
              </Button>
            </div>
          </form>
        </Form>
      )}

      {/* The paywall save confirmation — the switch changes what every free
          user sees the instant it saves, so the save is what gets confirmed. */}
      <AlertDialog
        open={paywallConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setPaywallConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {paywallConfirm?.turningOn
                ? 'Turn the statute paywall ON?'
                : 'Turn the statute paywall OFF?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {paywallConfirm?.turningOn
                ? `Every free user and guest will see only the first ${
                    paywallConfirm?.data[PAYWALL_SECTIONS_KEY] ?? ''
                  } sections of a statute, with an upgrade card. Paid users are not affected. This takes effect immediately when saved.`
                : 'Every free user and guest will get the full statute text again. This takes effect immediately when saved.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (paywallConfirm) {
                  commitSave(paywallConfirm.changed, paywallConfirm.data);
                }
                setPaywallConfirm(null);
              }}
            >
              {paywallConfirm?.turningOn ? 'Turn paywall on' : 'Turn paywall off'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
