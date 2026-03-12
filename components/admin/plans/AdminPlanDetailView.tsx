'use client';

import { useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Plus, X, Layers } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
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

import { useUpdateAdminPlan } from '@/lib/hooks/useAdmin';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminPlanDetail } from '@/types/admin-plans';

/******************************************************************************
                                 Schema
******************************************************************************/

const planFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Max 100 characters'),
  description: z.string().nullable(),
  is_active: z.boolean(),
  is_featured: z.boolean(),
  trial_eligible: z.boolean(),
  sort_order: z.number().int().min(0, 'Must be >= 0'),
  features: z.array(z.object({ value: z.string() })),
});

type PlanFormValues = z.infer<typeof planFormSchema>;

/******************************************************************************
                                 Helpers
******************************************************************************/

function DetailField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

/******************************************************************************
                                 Component
******************************************************************************/

interface AdminPlanDetailViewProps {
  plan: AdminPlanDetail;
}

export function AdminPlanDetailView({ plan }: AdminPlanDetailViewProps) {
  const updateMutation = useUpdateAdminPlan();

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: plan.name,
      description: plan.description ?? '',
      is_active: plan.is_active,
      is_featured: plan.is_featured,
      trial_eligible: plan.trial_eligible,
      sort_order: plan.sort_order ?? 0,
      features: plan.features.map((f) => ({ value: f })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'features',
  });

  // Reset when plan data changes
  useEffect(() => {
    form.reset({
      name: plan.name,
      description: plan.description ?? '',
      is_active: plan.is_active,
      is_featured: plan.is_featured,
      trial_eligible: plan.trial_eligible,
      sort_order: plan.sort_order ?? 0,
      features: plan.features.map((f) => ({ value: f })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id]);

  const onSubmit = useCallback(
    (data: PlanFormValues) => {
      updateMutation.mutate(
        {
          id: plan.id,
          payload: {
            name: data.name,
            description: data.description || null,
            is_active: data.is_active,
            is_featured: data.is_featured,
            trial_eligible: data.trial_eligible,
            sort_order: data.sort_order,
            features: data.features
              .map((f) => f.value.trim())
              .filter((v) => v.length > 0),
          },
        },
        {
          onSuccess: (response) => {
            toast.success(response.message || 'Plan updated successfully.');
            form.reset(data);
          },
          onError: (error) => {
            const apiError = extractApiError(error);
            toast.error(apiError.message);
          },
        }
      );
    },
    [form, plan.id, updateMutation]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Plan Details</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs ${
                plan.is_active
                  ? 'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50'
                  : 'text-muted-foreground border-border'
              }`}
            >
              {plan.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {plan.is_free ? 'Free' : 'Paid'}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-0">
        {/* Read-only info grid — synced from Paystack */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
          <DetailField label="Slug" value={plan.slug} />
          <DetailField label="Amount" value={plan.formatted_amount} />
          <DetailField label="Currency" value={plan.currency} />
          <DetailField label="Interval" value={plan.interval_label} />
          <DetailField label="Subscribers" value={plan.subscriptions_count} />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Synced from Paystack — cannot be changed here.
        </p>

        {/* Editable settings section */}
        <div className="mt-6 pt-5 border-t">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Settings
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Name + Sort Order side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Name</FormLabel>
                      <FormControl>
                        <Input maxLength={100} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sort_order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Sort Order</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Description</FormLabel>
                    <FormControl>
                      <Textarea
                        className="resize-none"
                        rows={2}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Toggle switches — 3 across */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium cursor-pointer">
                          Active
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Visible to users
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

                <FormField
                  control={form.control}
                  name="is_featured"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium cursor-pointer">
                          Featured
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Pricing highlight
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

                <FormField
                  control={form.control}
                  name="trial_eligible"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium cursor-pointer">
                          Trial
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Free trial allowed
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
              </div>

              {/* Features list */}
              <div className="space-y-1.5">
                <FormLabel className="text-xs">Features</FormLabel>
                <FormDescription className="text-xs">
                  Bullet points shown on the pricing card.
                </FormDescription>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <FormField
                      control={form.control}
                      name={`features.${index}.value`}
                      render={({ field: inputField }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              placeholder={`Feature ${index + 1}`}
                              {...inputField}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => remove(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ value: '' })}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Feature
                </Button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    !form.formState.isDirty || updateMutation.isPending
                  }
                  onClick={() => form.reset()}
                >
                  Discard
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
                  Save Plan
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </CardContent>
    </Card>
  );
}
