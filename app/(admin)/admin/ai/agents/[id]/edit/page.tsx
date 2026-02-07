'use client';

import { use, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useAdminAiAgent,
  useAdminAiModels,
  useUpdateAiAgent,
} from '@/lib/hooks/useAdminAi';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiAgent, AdminAiUpdateAgentData } from '@/types/admin-ai';

interface AiAgentEditPageProps {
  params: Promise<{ id: string }>;
}

const slugRegex = /^[a-z0-9-_]+$/;

const agentEditSchema = z.object({
  model_id: z.number({ message: 'AI model is required' }).int().positive('AI model is required'),
  name: z.string().min(1, 'Agent name is required').max(255),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(slugRegex, 'Slug must contain only lowercase letters, numbers, hyphens, and underscores'),
  description: z.string().optional(),
  system_prompt: z.string().optional(),
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

type AgentEditFormData = z.infer<typeof agentEditSchema>;

// ============================================
// Inner Form Component
// ============================================

interface AgentEditFormProps {
  id: number;
  agent: AdminAiAgent;
}

function AgentEditForm({ id, agent }: AgentEditFormProps) {
  const router = useRouter();

  const { data: modelsData } = useAdminAiModels({ per_page: 100 });
  const models = modelsData?.data || [];
  const updateMutation = useUpdateAiAgent();

  const form = useForm<AgentEditFormData>({
    resolver: zodResolver(agentEditSchema),
    defaultValues: {
      model_id: agent.model_id,
      name: agent.name,
      slug: agent.slug,
      description: agent.description || '',
      system_prompt: agent.system_prompt || '',
      temperature: agent.temperature ? Number(agent.temperature) : 0.7,
      max_response_tokens: agent.max_response_tokens || 2048,
      is_active: agent.is_active,
    },
  });

  const onSubmit = (formData: AgentEditFormData) => {
    const submitData: AdminAiUpdateAgentData = { ...formData };

    // Strip empty system_prompt (keep current if not changed)
    if (!submitData.system_prompt) {
      delete submitData.system_prompt;
    }
    // Strip empty description
    if (!submitData.description) {
      delete submitData.description;
    }

    updateMutation.mutate(
      { id, data: submitData },
      {
        onSuccess: (response) => {
          toast.success(response.message);
          router.push(`/admin/ai/agents/${id}`);
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          if (apiError.errors) {
            Object.entries(apiError.errors).forEach(([field, messages]) => {
              form.setError(field as keyof AgentEditFormData, {
                message: messages[0],
              });
            });
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
        {/* General Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle>Edit Agent</CardTitle>
            <CardDescription>
              Update the agent configuration and settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            {/* Name & Slug Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
          </CardContent>
        </Card>

        {/* System Prompt Card */}
        <Card>
          <CardHeader>
            <CardTitle>System Prompt</CardTitle>
            <CardDescription>
              The system prompt defines the agent&apos;s behavior and personality. Leave empty to keep the current prompt unchanged.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="system_prompt"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the system prompt for this agent... Supports markdown formatting."
                      className="min-h-[300px] font-mono text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/admin/ai/agents/${id}`)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ============================================
// Page Component (Outer Wrapper)
// ============================================

export default function AiAgentEditPage({ params }: AiAgentEditPageProps) {
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const { setOverride, clearOverride } = useBreadcrumbStore();

  const { data, isLoading, error } = useAdminAiAgent(id);

  // Set breadcrumb override
  useEffect(() => {
    if (data?.data?.name) {
      setOverride(idParam, data.data.name);
    }
    return () => {
      clearOverride(idParam);
    };
  }, [data?.data?.name, idParam, setOverride, clearOverride]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/ai/agents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Agents
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Agent not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href={`/admin/ai/agents/${id}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agent
        </Button>
      </Link>

      <AgentEditForm id={id} agent={data.data} />
    </div>
  );
}
