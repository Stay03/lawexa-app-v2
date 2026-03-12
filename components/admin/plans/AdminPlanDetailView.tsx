'use client';

import { useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
      sort_order: 0,
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
      sort_order: 0,
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Read-only plan info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan Info</CardTitle>
          <CardDescription>
            Synced from Paystack — cannot be changed here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailField label="Slug" value={plan.slug} />
          <DetailField label="Amount" value={plan.formatted_amount} />
          <DetailField label="Currency" value={plan.currency} />
          <DetailField label="Interval" value={plan.interval_label} />
          <DetailField
            label="Type"
            value={
              <Badge variant="outline" className="text-xs">
                {plan.is_free ? 'Free' : 'Paid'}
              </Badge>
            }
          />
          <DetailField
            label="Subscribers"
            value={plan.subscriptions_count}
          />
        </CardContent>
      </Card>

      {/* Editable plan metadata */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Plan Settings</CardTitle>
          <CardDescription>
            Update plan name, description, and configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input maxLength={100} {...field} />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        className="resize-none"
                        rows={3}
                        {...field}
                        value={field.value ?? ''}
                      />
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
                    <FormLabel>Sort Order</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        className="w-28"
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
                      Lower values appear first in the plan list.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Toggle switches */}
              <div className="space-y-3">
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
                          Inactive plans are hidden from users.
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
                          Highlighted on the pricing page.
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
                          Trial Eligible
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Allow users to start a free trial of this plan.
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
              <div className="space-y-2">
                <FormLabel>Features</FormLabel>
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
        </CardContent>
      </Card>
    </div>
  );
}
