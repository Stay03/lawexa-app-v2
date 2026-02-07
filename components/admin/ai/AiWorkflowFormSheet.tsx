'use client';

import { useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import {
  useAdminAiAgents,
  useCreateAiWorkflow,
  useUpdateAiWorkflow,
} from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type {
  AdminAiWorkflow,
  AdminAiCreateWorkflowData,
  AdminAiUpdateWorkflowData,
  WorkflowAgentRole,
} from '@/types/admin-ai';

interface AiWorkflowFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow?: AdminAiWorkflow | null;
}

// ============================================
// Schema
// ============================================

const workflowAgentFormSchema = z.object({
  agent_id: z.number().int().positive('Agent is required'),
  role: z.enum(['primary', 'specialist', 'fallback']),
  order: z.number().int().min(0),
});

const workflowFormSchema = z
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

type WorkflowFormData = z.infer<typeof workflowFormSchema>;

// ============================================
// Helpers
// ============================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-_]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const ROLE_OPTIONS: { value: WorkflowAgentRole; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'specialist', label: 'Specialist' },
  { value: 'fallback', label: 'Fallback' },
];

// ============================================
// Component
// ============================================

export function AiWorkflowFormSheet({
  open,
  onOpenChange,
  workflow,
}: AiWorkflowFormSheetProps) {
  const isEditMode = !!workflow;
  const slugManuallyEdited = useRef(false);

  const createMutation = useCreateAiWorkflow();
  const updateMutation = useUpdateAiWorkflow();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const { data: agentsData } = useAdminAiAgents({ per_page: 100 });
  const availableAgents = agentsData?.data || [];

  const form = useForm<WorkflowFormData>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      execution_mode: 'simple',
      orchestrator_agent_id: undefined,
      is_default: false,
      is_active: true,
      agents: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'agents',
  });

  // Reset form when sheet opens/closes or workflow changes
  useEffect(() => {
    if (open) {
      slugManuallyEdited.current = false;
      if (workflow) {
        form.reset({
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
        });
      } else {
        form.reset({
          name: '',
          slug: '',
          description: '',
          execution_mode: 'simple',
          orchestrator_agent_id: undefined,
          is_default: false,
          is_active: true,
          agents: [],
        });
      }
    }
  }, [open, workflow, form]);

  const onSubmit = (data: WorkflowFormData) => {
    const onSuccess = (response: { message: string }) => {
      toast.success(response.message);
      onOpenChange(false);
    };

    const onError = (error: unknown) => {
      const apiError = extractApiError(error);
      if (apiError.errors) {
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          form.setError(field as keyof WorkflowFormData, {
            message: messages[0],
          });
        });
      } else {
        toast.error(apiError.message);
      }
    };

    const apiData = {
      ...data,
      description: data.description || undefined,
      orchestrator_agent_id: data.orchestrator_agent_id || undefined,
    };

    if (isEditMode && workflow) {
      updateMutation.mutate(
        { id: workflow.id, data: apiData as AdminAiUpdateWorkflowData },
        { onSuccess, onError }
      );
    } else {
      createMutation.mutate(apiData as AdminAiCreateWorkflowData, {
        onSuccess,
        onError,
      });
    }
  };

  const handleAddAgent = () => {
    append({
      agent_id: 0,
      role: 'specialist',
      order: fields.length,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? 'Edit Workflow' : 'Add Workflow'}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Update the workflow configuration and agent assignments.'
              : 'Configure a new AI workflow with agent assignments.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1">
            <div className="space-y-4 px-6 py-4 flex-1">
              {/* Name */}
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
                        onChange={(e) => {
                          field.onChange(e);
                          if (!slugManuallyEdited.current) {
                            form.setValue('slug', generateSlug(e.target.value));
                          }
                        }}
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
                        placeholder="e.g. legal-research-workflow"
                        className="font-mono text-sm"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          slugManuallyEdited.current = true;
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Lowercase letters, numbers, hyphens, and underscores only.
                    </FormDescription>
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
                      Description <span className="text-muted-foreground font-normal">(optional)</span>
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
                      Orchestrator Agent <span className="text-muted-foreground font-normal">(optional)</span>
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

              {/* ============================================ */}
              {/* Dynamic Agent Array Builder                  */}
              {/* ============================================ */}
              <div className="space-y-3 pt-2">
                <div>
                  <h4 className="text-sm font-medium leading-none">Workflow Agents</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assign agents with roles and execution order. Exactly one agent must have the &apos;primary&apos; role.
                  </p>
                </div>

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
                {isEditMode ? 'Save Changes' : 'Create Workflow'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
