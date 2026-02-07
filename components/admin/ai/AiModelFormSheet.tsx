'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import {
  useAdminAiProviders,
  useCreateAiModel,
  useUpdateAiModel,
} from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiModel, AdminAiUpdateModelData } from '@/types/admin-ai';

interface AiModelFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model?: AdminAiModel | null;
}

const createSchema = z.object({
  provider_id: z.number({ message: 'Provider is required' }).int().positive('Provider is required'),
  name: z.string().min(1, 'Model name is required').max(255),
  model_id: z.string().min(1, 'Model ID is required').max(255),
  input_price_per_1m: z.number().min(0, 'Price must be 0 or greater').optional(),
  output_price_per_1m: z.number().min(0, 'Price must be 0 or greater').optional(),
  max_context_tokens: z.number().int().min(1000, 'Minimum context is 1000 tokens').optional(),
  supports_vision: z.boolean().optional(),
  supports_streaming: z.boolean().optional(),
});

type ModelFormData = z.infer<typeof createSchema>;

export function AiModelFormSheet({
  open,
  onOpenChange,
  model,
}: AiModelFormSheetProps) {
  const isEditMode = !!model;

  const { data: providersData } = useAdminAiProviders({ per_page: 100 });
  const activeProviders = (providersData?.data || []).filter((p) => p.is_active);

  const createMutation = useCreateAiModel();
  const updateMutation = useUpdateAiModel();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<ModelFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      provider_id: undefined,
      name: '',
      model_id: '',
      input_price_per_1m: undefined,
      output_price_per_1m: undefined,
      max_context_tokens: undefined,
      supports_vision: false,
      supports_streaming: false,
    },
  });

  // Reset form when sheet opens/closes or model changes
  useEffect(() => {
    if (open) {
      if (model) {
        form.reset({
          provider_id: model.provider_id,
          name: model.name,
          model_id: model.model_id,
          input_price_per_1m: model.input_price_per_1m ? Number(model.input_price_per_1m) : undefined,
          output_price_per_1m: model.output_price_per_1m ? Number(model.output_price_per_1m) : undefined,
          max_context_tokens: model.max_context_tokens || undefined,
          supports_vision: model.supports_vision,
          supports_streaming: model.supports_streaming,
        });
      } else {
        form.reset({
          provider_id: undefined,
          name: '',
          model_id: '',
          input_price_per_1m: undefined,
          output_price_per_1m: undefined,
          max_context_tokens: undefined,
          supports_vision: false,
          supports_streaming: false,
        });
      }
    }
  }, [open, model, form]);

  const onSubmit = (data: ModelFormData) => {
    const onSuccess = (response: { message: string }) => {
      toast.success(response.message);
      onOpenChange(false);
    };

    const onError = (error: unknown) => {
      const apiError = extractApiError(error);
      if (apiError.errors) {
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          form.setError(field as keyof ModelFormData, {
            message: messages[0],
          });
        });
      } else {
        toast.error(apiError.message);
      }
    };

    if (isEditMode && model) {
      updateMutation.mutate(
        { id: model.id, data: data as AdminAiUpdateModelData },
        { onSuccess, onError }
      );
    } else {
      createMutation.mutate(data, { onSuccess, onError });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? 'Edit Model' : 'Add Model'}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Update the model configuration.'
              : 'Configure a new AI model linked to a provider.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1">
            <div className="space-y-4 px-6 py-4 flex-1">
              {/* Provider Select */}
              <FormField
                control={form.control}
                name="provider_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    {activeProviders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No active providers found.{' '}
                        <Link
                          href="/admin/ai/providers"
                          className="text-primary hover:underline"
                        >
                          Create a provider first.
                        </Link>
                      </p>
                    ) : (
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeProviders.map((provider) => (
                            <SelectItem
                              key={provider.id}
                              value={String(provider.id)}
                            >
                              {provider.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. GPT-4o" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Model ID */}
              <FormField
                control={form.control}
                name="model_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. openai/gpt-4o"
                        className="font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Pricing Row */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="input_price_per_1m"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Input $/1M tokens</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="e.g. 2.50"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === '' ? undefined : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="output_price_per_1m"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Output $/1M tokens</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="e.g. 10.00"
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === '' ? undefined : Number(e.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Max Context Tokens */}
              <FormField
                control={form.control}
                name="max_context_tokens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Context Tokens</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1000"
                        placeholder="e.g. 128000"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === '' ? undefined : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Capability Switches */}
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="supports_vision"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm font-medium cursor-pointer">
                        Supports Vision
                      </FormLabel>
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
                  name="supports_streaming"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm font-medium cursor-pointer">
                        Supports Streaming
                      </FormLabel>
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
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditMode ? 'Save Changes' : 'Create Model'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
