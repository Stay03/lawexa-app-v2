'use client';

import { use, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Plus, Trash2 } from 'lucide-react';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useAdminAiWorkflow,
  useAdminAiAgents,
  useUpdateAiWorkflow,
} from '@/lib/hooks/useAdminAi';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';
import { extractApiError } from '@/lib/utils/api-error';
import type {
  AdminAiWorkflow,
  AdminAiUpdateWorkflowData,
  WorkflowAgentRole,
} from '@/types/admin-ai';

interface AiWorkflowEditPageProps {
  params: Promise<{ id: string }>;
}

// ============================================
// Schema
// ============================================

const workflowAgentFormSchema = z.object({
  agent_id: z.number().int().positive('Agent is required'),
  role: z.enum(['primary', 'specialist', 'fallback']),
  order: z.number().int().min(0),
});

const workflowEditSchema = z
  .object({
    name: z.string().min(1, 'Workflow name is required').max(255),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .max(100)
      .regex(
        /^[a-z0-9-_]+$/,
        'Slug must contain only lowercase letters, numbers, hyphens, and underscores'
      ),
    description: z.string().optional(),
    execution_mode: z.enum(['simple', 'react']),
    orchestrator_agent_id: z.number().int().positive().optional(),
    is_default: z.boolean().optional(),
    is_active: z.boolean().optional(),
    agents: z
      .array(workflowAgentFormSchema)
      .min(1, 'At least one agent must be assigned'),
  })
  .refine(
    (data) => {
      const primaryCount = data.agents.filter(
        (a) => a.role === 'primary'
      ).length;
      return primaryCount === 1;
    },
    {
      message: 'Exactly one agent must have the primary role',
      path: ['agents'],
    }
  );

type WorkflowEditFormData = z.infer<typeof workflowEditSchema>;

// ============================================
// Helpers
// ============================================

const ROLE_OPTIONS: { value: WorkflowAgentRole; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'fallback', label: 'Fallback' },
];

// ============================================
// Inner Form Component
// ============================================

interface WorkflowEditFormProps {
  id: number;
  workflow: AdminAiWorkflow;
}

function WorkflowEditForm({ id, workflow }: WorkflowEditFormProps) {
  const router = useRouter();

  const { data: agentsData } = useAdminAiAgents({ per_page: 100 });
  const availableAgents = agentsData?.data || [];
  const updateMutation = useUpdateAiWorkflow();

  const form = useForm<WorkflowEditFormData>({
    resolver: zodResolver(workflowEditSchema),
    defaultValues: {
      name: workflow.name,
      slug: workflow.slug,
      description: workflow.description || '',
      execution_mode: workflow.execution_mode,
      orchestrator_agent_id: workflow.orchestrator_agent_id ?? undefined,
      is_default: workflow.is_default,
      is_active: workflow.is_active,
      agents: workflow.agents.map((agent) => ({
        agent_id: agent.id,
        role: agent.role,
        order: agent.order,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'agents',
  });

  const onSubmit = (formData: WorkflowEditFormData) => {
    const apiData: AdminAiUpdateWorkflowData = {
      ...formData,
      description: formData.description || undefined,
      orchestrator_agent_id: formData.orchestrator_agent_id || undefined,
    };

    updateMutation.mutate(
      { id, data: apiData },
      {
        onSuccess: (response) => {
          toast.success(response.message);
          router.push(`/admin/ai/workflows/${id}`);
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          if (apiError.errors) {
            Object.entries(apiError.errors).forEach(([field, messages]) => {
              form.setError(field as keyof WorkflowEditFormData, {
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

  const handleAddAgent = () => {
    append({
      agent_id: 0,
      role: 'specialist',
      order: fields.length,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Card 1: Workflow Details */}
        <Card>
          <CardHeader>
            <CardTitle>Edit Workflow</CardTitle>
            <CardDescription>
              Update the workflow configuration and settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                        placeholder="e.g. Legal Research Workflow"
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
                        placeholder="e.g. legal-research-workflow"
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
                      placeholder="Describe what this workflow does..."
                      className="min-h-[80px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Card 2: Execution Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Execution Settings</CardTitle>
            <CardDescription>
              Configure how this workflow executes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Execution Mode */}
            <FormField
              control={form.control}
              name="execution_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Execution Mode</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select execution mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="simple">Simple</SelectItem>
                      <SelectItem value="react">ReAct</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Simple: single LLM call. ReAct: reasoning + acting loop with tool calls.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Orchestrator Agent */}
            <FormField
              control={form.control}
              name="orchestrator_agent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Orchestrator Agent
                    <span className="ml-1 text-xs text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </FormLabel>
                  <Select
                    value={field.value ? String(field.value) : 'none'}
                    onValueChange={(value) =>
                      field.onChange(value === 'none' ? undefined : Number(value))
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select orchestrator agent" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {availableAgents.map((agent) => (
                        <SelectItem key={agent.id} value={String(agent.id)}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Switches */}
            <div className="space-y-3">
              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium cursor-pointer">
                        Default Workflow
                      </FormLabel>
                      <FormDescription className="text-xs">
                        Setting as default will unset the current default workflow.
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
          </CardContent>
        </Card>

        {/* Card 3: Workflow Agents */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow Agents</CardTitle>
            <CardDescription>
              Assign agents with roles and execution order. Exactly one agent must have the &apos;primary&apos; role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {fields.length > 0 && (
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-2 rounded-lg border p-3"
                  >
                    {/* Visual Order Index */}
                    <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 text-center">
                      #{index + 1}
                    </span>

                    {/* Agent Select */}
                    <FormField
                      control={form.control}
                      name={`agents.${index}.agent_id`}
                      render={({ field: agentField }) => (
                        <FormItem className="flex-1 min-w-0 space-y-0">
                          <Select
                            value={agentField.value ? String(agentField.value) : ''}
                            onValueChange={(value) =>
                              agentField.onChange(Number(value))
                            }
                          >
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select agent" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableAgents.map((agent) => (
                                <SelectItem
                                  key={agent.id}
                                  value={String(agent.id)}
                                >
                                  {agent.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Role Select */}
                    <FormField
                      control={form.control}
                      name={`agents.${index}.role`}
                      render={({ field: roleField }) => (
                        <FormItem className="w-[130px] shrink-0 space-y-0">
                          <Select
                            value={roleField.value}
                            onValueChange={roleField.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ROLE_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Order Input */}
                    <FormField
                      control={form.control}
                      name={`agents.${index}.order`}
                      render={({ field: orderField }) => (
                        <FormItem className="w-[70px] shrink-0 space-y-0">
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="Order"
                              className="h-9 text-center"
                              value={orderField.value ?? ''}
                              onChange={(e) =>
                                orderField.onChange(
                                  e.target.value === ''
                                    ? 0
                                    : Number(e.target.value)
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Remove Button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Agent Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleAddAgent}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Agent
            </Button>

            {/* Agents Array Error */}
            {form.formState.errors.agents?.message && (
              <p className="text-sm text-destructive">
                {form.formState.errors.agents.message}
              </p>
            )}
            {form.formState.errors.agents?.root?.message && (
              <p className="text-sm text-destructive">
                {form.formState.errors.agents.root.message}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/admin/ai/workflows/${id}`)}
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

export default function AiWorkflowEditPage({ params }: AiWorkflowEditPageProps) {
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const { setOverride, clearOverride } = useBreadcrumbStore();

  const { data, isLoading, error } = useAdminAiWorkflow(id);

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
        <Skeleton className="h-[300px] w-full" />
        <Skeleton className="h-[250px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/ai/workflows">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workflows
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Workflow not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href={`/admin/ai/workflows/${id}`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Workflow
        </Button>
      </Link>

      <WorkflowEditForm id={id} workflow={data.data} />
    </div>
  );
}
