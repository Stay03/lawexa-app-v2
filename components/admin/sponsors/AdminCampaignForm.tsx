'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import { useAdminPlans } from '@/lib/hooks/useAdmin';
import { useCreateCampaign } from '@/lib/hooks/useAdminSponsors';
import { extractApiError } from '@/lib/utils/api-error';
import {
  campaignCreateSchema,
  type CampaignCreateValues,
} from '@/lib/validations/admin-sponsors';
import type { AdminCampaignCreatePayload } from '@/types/admin-sponsors';

interface AdminCampaignFormProps {
  sponsorId: number;
}

export function AdminCampaignForm({ sponsorId }: AdminCampaignFormProps) {
  const router = useRouter();
  const createMutation = useCreateCampaign();

  // Public, active, non-internal plans only — admins should not pick another
  // campaign's auto-generated internal plan here.
  const { data: plansData, isLoading: plansLoading } = useAdminPlans({
    is_active: true,
    per_page: 100,
  });
  const eligiblePlans = useMemo(
    () => (plansData?.data ?? []).filter((p) => !p.is_internal && !p.is_free),
    [plansData?.data]
  );

  const form = useForm<CampaignCreateValues>({
    resolver: zodResolver(campaignCreateSchema),
    defaultValues: {
      type: 'plan',
      name: '',
      plan_id: 0,
      duration_days: 90,
      max_grants: null,
      notes: null,
    } as CampaignCreateValues,
  });

  const campaignType = form.watch('type');

  // Reset hidden branch fields when switching tabs to avoid stale errors.
  useEffect(() => {
    form.clearErrors();
    if (campaignType === 'plan') {
      form.setValue(
        'pack_size' as keyof CampaignCreateValues,
        undefined as never
      );
    } else {
      form.setValue(
        'plan_id' as keyof CampaignCreateValues,
        undefined as never
      );
      form.setValue(
        'duration_days' as keyof CampaignCreateValues,
        undefined as never
      );
    }
  }, [campaignType, form]);

  const onSubmit = (values: CampaignCreateValues) => {
    const payload: AdminCampaignCreatePayload =
      values.type === 'plan'
        ? {
            name: values.name,
            type: 'plan',
            plan_id: values.plan_id,
            duration_days: values.duration_days,
            max_grants: values.max_grants ?? undefined,
            notes: values.notes ?? undefined,
          }
        : {
            name: values.name,
            type: 'pack',
            pack_size: values.pack_size,
            max_grants: values.max_grants ?? undefined,
            notes: values.notes ?? undefined,
          };

    createMutation.mutate(
      { sponsorId, payload },
      {
        onSuccess: (response) => {
          toast.success(response.message || 'Campaign created');
          router.push(`/admin/campaigns/${response.data.id}`);
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          if (apiError.errors) {
            let pushed = false;
            Object.entries(apiError.errors).forEach(([field, messages]) => {
              if (field in form.getValues()) {
                form.setError(field as keyof CampaignCreateValues, {
                  message: messages[0],
                });
                pushed = true;
              }
            });
            if (!pushed) toast.error(apiError.message);
          } else {
            toast.error(apiError.message);
          }
        },
      }
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign basics</CardTitle>
            <CardDescription>
              Campaign starts in <strong>draft</strong>. You&apos;ll activate it
              before issuing grants.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Q2 2026" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Optional context (e.g. cohort, budget owner)"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What students get</CardTitle>
            <CardDescription>
              A subscription to an existing plan, or a one-shot bundle of AI
              messages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <Tabs
                    value={field.value}
                    onValueChange={field.onChange}
                    className="w-full"
                  >
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                      <TabsTrigger value="plan">Subscription plan</TabsTrigger>
                      <TabsTrigger value="pack">Message pack</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FormItem>
              )}
            />

            {campaignType === 'plan' && (
              <div className="space-y-5">
                <FormField
                  control={form.control}
                  name="plan_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(value) => field.onChange(Number(value))}
                        disabled={plansLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                plansLoading
                                  ? 'Loading plans…'
                                  : 'Select a plan'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {eligiblePlans.map((plan) => (
                            <SelectItem key={plan.id} value={String(plan.id)}>
                              {plan.name}{' '}
                              <span className="text-muted-foreground">
                                ({plan.formatted_amount} / {plan.interval_label}
                                )
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Each granted student gets a subscription to this plan
                        for <strong>duration_days</strong>.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duration_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (days, per student)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={3650}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value)
                            )
                          }
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        Each granted subscription runs for this many days.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {campaignType === 'pack' && (
              <FormField
                control={form.control}
                name="pack_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pack size (messages per student)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100_000}
                        placeholder="50"
                        value={
                          field.value === undefined || field.value === null
                            ? ''
                            : String(field.value)
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === '' ? '' : Number(v));
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      Each granted student receives a one-shot pack of this many
                      AI messages. Stacks with existing quotas; no time limit.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cap</CardTitle>
            <CardDescription>
              Optional ceiling on the total number of grants this campaign
              issues.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="max_grants"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max grants (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="No cap"
                      value={
                        field.value === undefined || field.value === null
                          ? ''
                          : String(field.value)
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === '' ? null : Number(v));
                      }}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    Leave empty for no cap. Excess emails go to{' '}
                    <code>cap_reached</code>.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create campaign
          </Button>
        </div>
      </form>
    </Form>
  );
}
