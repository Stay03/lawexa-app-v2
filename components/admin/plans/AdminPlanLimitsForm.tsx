'use client';

import { useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  useUpdateAdminPlanLimits,
  useUpdateFreePlanLimits,
} from '@/lib/hooks/useAdmin';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminPlanDetail, AdminLimitPeriod } from '@/types/admin-plans';
import type { IPlanLimit } from '@/types/subscription';

/******************************************************************************
                                 Schema
******************************************************************************/

const limitSchema = z.object({
  limit_value: z.number().int().min(-1, 'Min value is -1'),
  period: z.enum(['month', 'day', 'lifetime', 'billing_interval']),
});

const limitsFormSchema = z.object({
  ai_messages: limitSchema,
  bookmarks: limitSchema,
  note_creations: limitSchema,
});

type LimitsFormValues = z.infer<typeof limitsFormSchema>;

/******************************************************************************
                                 Constants
******************************************************************************/

const LIMIT_TYPES = ['ai_messages', 'bookmarks', 'note_creations'] as const;

const LIMIT_LABELS: Record<string, string> = {
  ai_messages: 'AI Messages',
  bookmarks: 'Bookmarks',
  note_creations: 'Note Creations',
};

const PERIOD_OPTIONS: { value: AdminLimitPeriod; label: string }[] = [
  { value: 'billing_interval', label: 'Per Billing Interval' },
  { value: 'month', label: 'Per Month' },
  { value: 'day', label: 'Per Day' },
  { value: 'lifetime', label: 'Lifetime' },
];

/******************************************************************************
                                 Helpers
******************************************************************************/

function findLimit(
  limits: IPlanLimit[],
  type: string
): { value: number; period: AdminLimitPeriod } {
  const found = limits.find((l) => l.type === type);
  return {
    value: found?.value ?? 0,
    period: (found?.period as AdminLimitPeriod) ?? 'month',
  };
}

/******************************************************************************
                                 Component
******************************************************************************/

interface AdminPlanLimitsFormProps {
  plan: AdminPlanDetail;
}

export function AdminPlanLimitsForm({ plan }: AdminPlanLimitsFormProps) {
  const updateLimitsMutation = useUpdateAdminPlanLimits();
  const updateFreeLimitsMutation = useUpdateFreePlanLimits();
  const mutation = plan.is_free ? updateFreeLimitsMutation : updateLimitsMutation;

  const form = useForm<LimitsFormValues>({
    resolver: zodResolver(limitsFormSchema),
    defaultValues: {
      ai_messages: findLimit(plan.limits, 'ai_messages'),
      bookmarks: findLimit(plan.limits, 'bookmarks'),
      note_creations: findLimit(plan.limits, 'note_creations'),
    },
  });

  // Reset when plan data changes
  useEffect(() => {
    form.reset({
      ai_messages: findLimit(plan.limits, 'ai_messages'),
      bookmarks: findLimit(plan.limits, 'bookmarks'),
      note_creations: findLimit(plan.limits, 'note_creations'),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, plan.limits]);

  const onSubmit = useCallback(
    (data: LimitsFormValues) => {
      const limits = LIMIT_TYPES.map((type) => ({
        limit_type: type,
        limit_value: data[type].limit_value,
        period: data[type].period,
      }));

      const payload = { limits };

      const mutateArgs = plan.is_free
        ? payload
        : { id: plan.id, payload };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mutation as any).mutate(mutateArgs, {
        onSuccess: (response: { message?: string }) => {
          toast.success(
            response.message || 'Plan limits updated successfully.'
          );
          form.reset(data);
        },
        onError: (error: unknown) => {
          const apiError = extractApiError(error);
          toast.error(apiError.message);
        },
      });
    },
    [form, mutation, plan.id, plan.is_free]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plan Limits</CardTitle>
        <CardDescription>
          Set usage limits for this plan. Use -1 for unlimited, 0 for no access.
          {plan.is_free && (
            <span className="block mt-1 text-xs font-medium text-orange-600 dark:text-orange-400">
              Free plan limits are shared defaults (plan_id = NULL).
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {LIMIT_TYPES.map((type) => (
              <div
                key={type}
                className="rounded-lg border p-4 space-y-3"
              >
                <p className="text-sm font-medium">{LIMIT_LABELS[type]}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`${type}.limit_value`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Value</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="-1"
                            className="w-full"
                            value={field.value ?? 0}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ''
                                  ? 0
                                  : parseInt(e.target.value, 10)
                              )
                            }
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          -1 = unlimited, 0 = no access
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`${type}.period`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Period</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PERIOD_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={!form.formState.isDirty || mutation.isPending}
                onClick={() => form.reset()}
              >
                Discard
              </Button>
              <Button
                type="submit"
                disabled={!form.formState.isDirty || mutation.isPending}
              >
                {mutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Limits
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
