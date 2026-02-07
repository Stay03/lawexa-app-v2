'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  useAdminAiModels,
  useCreateAiAgent,
  useUpdateAiAgent,
} from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiAgent, AdminAiUpdateAgentData } from '@/types/admin-ai';

interface AiAgentFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent?: AdminAiAgent | null;
}

const slugRegex = /^[a-z0-9-_]+$/;

function getAgentSchema(isEditMode: boolean) {
  return z.object({
    model_id: z.number({ message: 'AI model is required' }).int().positive('AI model is required'),
    name: z.string().min(1, 'Agent name is required').max(255),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .max(100)
      .regex(slugRegex, 'Slug must contain only lowercase letters, numbers, hyphens, and underscores'),
    description: z.string().optional(),
    system_prompt: isEditMode
      ? z.string().optional()
      : z.string().min(1, 'System prompt is required'),
    temperature: z
      .number()
      .min(0, 'Temperature must be between 0 and 2')
      .max(2, 'Temperature must be between 0 and 2')
      .optional(),
    max_response_tokens: z
      .number()
      .int()
      .min(100, 'Minimum is 100 tokens')
      .max(32000, 'Maximum is 32000 tokens')
      .optional(),
    is_active: z.boolean().optional(),
  });
}

type AgentFormData = z.infer<ReturnType<typeof getAgentSchema>>;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function AiAgentFormSheet({
  open,
  onOpenChange,
  agent,
}: AiAgentFormSheetProps) {
  const isEditMode = !!agent;
  const slugManuallyEdited = useRef(false);

  const { data: modelsData } = useAdminAiModels({ per_page: 100 });
  const models = modelsData?.data || [];

  const createMutation = useCreateAiAgent();
  const updateMutation = useUpdateAiAgent();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const schema = useMemo(() => getAgentSchema(isEditMode), [isEditMode]);

  const form = useForm<AgentFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      model_id: undefined,
      name: '',
      slug: '',
      description: '',
      system_prompt: '',
      temperature: 0.7,
      max_response_tokens: 2048,
      is_active: true,
    },
  });

  // Reset form when sheet opens/closes or agent changes
  useEffect(() => {
    if (open) {
      slugManuallyEdited.current = false;
      if (agent) {
        form.reset({
          model_id: agent.model_id,
          name: agent.name,
          slug: agent.slug,
          description: agent.description || '',
          system_prompt: '',
          temperature: agent.temperature ? Number(agent.temperature) : 0.7,
          max_response_tokens: agent.max_response_tokens || 2048,
          is_active: agent.is_active,
        });
      } else {
        form.reset({
          model_id: undefined,
          name: '',
          slug: '',
          description: '',
          system_prompt: '',
          temperature: 0.7,
          max_response_tokens: 2048,
          is_active: true,
        });
      }
    }
  }, [open, agent, form]);

  const handleNameChange = (value: string, onChange: (v: string) => void) => {
    onChange(value);
    if (!isEditMode && !slugManuallyEdited.current) {
      form.setValue('slug', generateSlug(value), { shouldValidate: false });
    }
  };

  const handleSlugChange = (value: string, onChange: (v: string) => void) => {
    slugManuallyEdited.current = true;
    onChange(value);
  };

  const onSubmit = (data: AgentFormData) => {
    const submitData = { ...data };
    // Strip empty system_prompt in edit mode
    if (isEditMode && !submitData.system_prompt) {
      delete submitData.system_prompt;
    }
    // Strip empty description
    if (!submitData.description) {
      delete submitData.description;
    }

    const onSuccess = (response: { message: string }) => {
      toast.success(response.message);
      onOpenChange(false);
    };

    const onError = (error: unknown) => {
      const apiError = extractApiError(error);
      if (apiError.errors) {
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          form.setError(field as keyof AgentFormData, {
            message: messages[0],
          });
        });
      } else {
        toast.error(apiError.message);
      }
    };

    if (isEditMode && agent) {
      updateMutation.mutate(
        { id: agent.id, data: submitData as AdminAiUpdateAgentData },
        { onSuccess, onError }
      );
    } else {
      createMutation.mutate(
        submitData as { model_id: number; name: string; slug: string; system_prompt: string; description?: string; temperature?: number; max_response_tokens?: number; is_active?: boolean },
        { onSuccess, onError }
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? 'Edit Agent' : 'Add Agent'}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Update the agent configuration.'
              : 'Configure a new AI agent linked to a model.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1">
            <div className="space-y-4 px-6 py-4 flex-1">
              {/* Model Select */}
              <FormField
                control={form.control}
                name="model_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    {models.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No models found.{' '}
                        <Link
                          href="/admin/ai/models"
                          className="text-primary hover:underline"
                        >
                          Create a model first.
                        </Link>
                      </p>
                    ) : (
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {models.map((model) => (
                            <SelectItem
                              key={model.id}
                              value={String(model.id)}
                            >
                              {model.name}
                              {model.provider ? ` (${model.provider.name})` : ''}
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
                      <Input
                        placeholder="e.g. Legal Research Assistant"
                        {...field}
                        onChange={(e) =>
                          handleNameChange(e.target.value, field.onChange)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Slug */}
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. legal-research-assistant"
                        className="font-mono text-sm"
                        {...field}
                        onChange={(e) =>
                          handleSlugChange(e.target.value, field.onChange)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Description
                      <span className="ml-1 text-xs text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of the agent's purpose"
                        className="min-h-[80px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* System Prompt */}
              <FormField
                control={form.control}
                name="system_prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      System Prompt
                      {isEditMode && (
                        <span className="ml-1 text-xs text-muted-foreground font-normal">
                          (leave empty to keep current)
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={
                          isEditMode
                            ? 'System prompt is set but not displayed for security. Leave empty to keep current, or enter a new prompt to replace it.'
                            : 'Enter the system prompt for this agent...'
                        }
                        className="min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Temperature & Max Tokens Row */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperature</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="2"
                          placeholder="0.7"
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
                  name="max_response_tokens"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Response Tokens</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="100"
                          max="32000"
                          placeholder="2048"
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

              {/* Active Switch */}
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel className="text-sm font-medium cursor-pointer">
                      Active
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
                {isEditMode ? 'Save Changes' : 'Create Agent'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
