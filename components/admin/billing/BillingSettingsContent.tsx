'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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

import { useAdminSettings, useUpdateAdminSettings } from '@/lib/hooks/useAdmin';
import { extractApiError } from '@/lib/utils/api-error';
import { BILLING_SETTING_GROUPS } from '@/types/admin-settings';
import type { AdminSetting, AdminSettingGroup } from '@/types/admin-settings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GROUP_LABELS: Record<string, string> = {
  subscription: 'Subscription Settings',
  trial: 'Trial Settings',
  limits: 'Limits & Quotas',
};

const GROUP_DESCRIPTIONS: Record<string, string> = {
  subscription: 'Configure subscription behavior and payment settings.',
  trial: 'Manage free trial duration, features, and enrollment.',
  limits: 'Set message limits, storage quotas, and usage caps.',
};

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
// Field renderer
// ---------------------------------------------------------------------------

interface SettingFieldProps {
  setting: AdminSetting;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
}

function SettingField({ setting, control }: SettingFieldProps) {
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
          <FormItem>
            <FormLabel>{label}</FormLabel>
            {setting.description && (
              <FormDescription className="text-xs">
                {setting.description}
              </FormDescription>
            )}
            <FormControl>
              <Input
                type="number"
                min="0"
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

  if (setting.type === 'json') {
    return (
      <FormField
        control={control}
        name={setting.key}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            {setting.description && (
              <FormDescription className="text-xs">
                {setting.description}
              </FormDescription>
            )}
            <FormControl>
              <Textarea className="font-mono text-sm" rows={4} {...field} />
            </FormControl>
          </FormItem>
        )}
      />
    );
  }

  // Default: string
  return (
    <FormField
      control={control}
      name={setting.key}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {setting.description && (
            <FormDescription className="text-xs">
              {setting.description}
            </FormDescription>
          )}
          <FormControl>
            <Input {...field} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SettingsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-lg border p-6 space-y-4">
          <Skeleton className="h-6 w-[180px]" />
          <Skeleton className="h-4 w-[300px]" />
          {[...Array(3)].map((_, j) => (
            <div key={j} className="flex items-center justify-between">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-6 w-[60px]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BillingSettingsContent() {
  const subscriptionQuery = useAdminSettings({ group: 'subscription' });
  const trialQuery = useAdminSettings({ group: 'trial' });
  const limitsQuery = useAdminSettings({ group: 'limits' });

  const isLoading =
    subscriptionQuery.isLoading || trialQuery.isLoading || limitsQuery.isLoading;
  const isError =
    subscriptionQuery.isError || trialQuery.isError || limitsQuery.isError;

  const allSettings = useMemo(
    () => [
      ...(subscriptionQuery.data?.data || []),
      ...(trialQuery.data?.data || []),
      ...(limitsQuery.data?.data || []),
    ],
    [subscriptionQuery.data, trialQuery.data, limitsQuery.data]
  );

  const settingsByGroup = useMemo(() => {
    const groups = new Map<AdminSettingGroup, AdminSetting[]>();
    for (const setting of allSettings) {
      const list = groups.get(setting.group) || [];
      list.push(setting);
      groups.set(setting.group, list);
    }
    return groups;
  }, [allSettings]);

  // Dynamic zod schema
  const schema = useMemo(() => {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const setting of allSettings) {
      switch (setting.type) {
        case 'boolean':
          shape[setting.key] = z.boolean();
          break;
        case 'integer':
          shape[setting.key] = z.number().int();
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

  // Reset form when server data loads / changes
  useEffect(() => {
    if (allSettings.length > 0) {
      form.reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  const updateMutation = useUpdateAdminSettings();

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
          },
        }
      );
    },
    [form, updateMutation]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Billing Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage subscription, trial, and limit configurations.
        </p>
      </div>

      {isLoading && <SettingsLoadingSkeleton />}

      {isError && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Failed to load settings.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                subscriptionQuery.refetch();
                trialQuery.refetch();
                limitsQuery.refetch();
              }}
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
              No billing settings found.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && allSettings.length > 0 && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {BILLING_SETTING_GROUPS.map((groupKey) => {
              const settings = settingsByGroup.get(groupKey);
              if (!settings || settings.length === 0) return null;
              return (
                <Card key={groupKey}>
                  <CardHeader>
                    <CardTitle>
                      {GROUP_LABELS[groupKey] || formatLabel(groupKey)}
                    </CardTitle>
                    {GROUP_DESCRIPTIONS[groupKey] && (
                      <CardDescription>
                        {GROUP_DESCRIPTIONS[groupKey]}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {settings.map((setting) => (
                      <SettingField
                        key={setting.key}
                        setting={setting}
                        control={form.control}
                      />
                    ))}
                  </CardContent>
                </Card>
              );
            })}

            <div className="flex items-center justify-end gap-3 pt-2 pb-8">
              <Button
                type="button"
                variant="outline"
                disabled={!form.formState.isDirty || updateMutation.isPending}
                onClick={() => form.reset(defaultValues)}
              >
                Discard Changes
              </Button>
              <Button
                type="submit"
                disabled={!form.formState.isDirty || updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Settings
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
