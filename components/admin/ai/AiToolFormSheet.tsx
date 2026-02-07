'use client';

import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import {
  useCreateAiTool,
  useUpdateAiTool,
} from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiTool, AdminAiCreateToolData, AdminAiUpdateToolData } from '@/types/admin-ai';

interface AiToolFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool?: AdminAiTool | null;
}

const nameRegex = /^[a-z0-9_]+$/;

const toolFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Tool name is required')
    .max(100)
    .regex(nameRegex, 'Must contain only lowercase letters, numbers, and underscores'),
  display_name: z.string().min(1, 'Display name is required').max(255),
  description: z.string().min(1, 'Description is required'),
  category: z.string().max(50).optional(),
  endpoint_url: z.string().min(1, 'Endpoint URL is required').max(500),
  http_method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], {
    message: 'HTTP method is required',
  }),
  parameters: z
    .string()
    .min(1, 'Parameters JSON is required')
    .refine(
      (val) => {
        try {
          const parsed = JSON.parse(val);
          return parsed && typeof parsed === 'object' && parsed.type === 'object';
        } catch {
          return false;
        }
      },
      { message: 'Must be valid JSON with root type "object"' }
    ),
  timeout_seconds: z
    .number()
    .int()
    .min(5, 'Minimum 5 seconds')
    .max(120, 'Maximum 120 seconds')
    .optional(),
  retry_count: z.number().int().min(0).max(5, 'Maximum 5 retries').optional(),
  requires_auth: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

type ToolFormData = z.infer<typeof toolFormSchema>;

const DEFAULT_PARAMETERS = '{\n  "type": "object",\n  "properties": {},\n  "required": []\n}';

function generateToolName(displayName: string): string {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_');
}

export function AiToolFormSheet({
  open,
  onOpenChange,
  tool,
}: AiToolFormSheetProps) {
  const isEditMode = !!tool;
  const nameManuallyEdited = useRef(false);

  const createMutation = useCreateAiTool();
  const updateMutation = useUpdateAiTool();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<ToolFormData>({
    resolver: zodResolver(toolFormSchema),
    defaultValues: {
      name: '',
      display_name: '',
      description: '',
      category: '',
      endpoint_url: '',
      http_method: 'POST' as const,
      parameters: DEFAULT_PARAMETERS,
      timeout_seconds: 30,
      retry_count: 0,
      requires_auth: true,
      is_active: true,
    },
  });

  // Reset form when sheet opens/closes or tool changes
  useEffect(() => {
    if (open) {
      nameManuallyEdited.current = false;
      if (tool) {
        form.reset({
          name: tool.name,
          display_name: tool.display_name,
          description: tool.description,
          category: tool.category || '',
          endpoint_url: tool.endpoint_url,
          http_method: tool.http_method,
          parameters: JSON.stringify(tool.parameters, null, 2),
          timeout_seconds: tool.timeout_seconds,
          retry_count: tool.retry_count,
          requires_auth: tool.requires_auth,
          is_active: tool.is_active,
        });
      } else {
        form.reset({
          name: '',
          display_name: '',
          description: '',
          category: '',
          endpoint_url: '',
          http_method: 'POST' as const,
          parameters: DEFAULT_PARAMETERS,
          timeout_seconds: 30,
          retry_count: 0,
          requires_auth: true,
          is_active: true,
        });
      }
    }
  }, [open, tool, form]);

  const onSubmit = (data: ToolFormData) => {
    const parsedParameters = JSON.parse(data.parameters);

    const onSuccess = (response: { message: string }) => {
      toast.success(response.message);
      onOpenChange(false);
    };

    const onError = (error: unknown) => {
      const apiError = extractApiError(error);
      if (apiError.errors) {
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          form.setError(field as keyof ToolFormData, {
            message: messages[0],
          });
        });
      } else {
        toast.error(apiError.message);
      }
    };

    const apiData = {
      ...data,
      parameters: parsedParameters,
      category: data.category || undefined,
    };

    if (isEditMode && tool) {
      updateMutation.mutate(
        { id: tool.id, data: apiData as AdminAiUpdateToolData },
        { onSuccess, onError }
      );
    } else {
      createMutation.mutate(apiData as AdminAiCreateToolData, {
        onSuccess,
        onError,
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? 'Edit Tool' : 'Add Tool'}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Update the tool configuration.'
              : 'Configure a new AI tool.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1">
            <div className="space-y-4 px-6 py-4 flex-1">
              {/* Display Name */}
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Search Cases"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (!nameManuallyEdited.current) {
                            form.setValue('name', generateToolName(e.target.value));
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Name (snake_case) */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. search_cases"
                        className="font-mono text-sm"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          nameManuallyEdited.current = true;
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Lowercase letters, numbers, and underscores only.
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what this tool does (used for LLM context)..."
                        className="min-h-[80px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category */}
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Category <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. cases"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Endpoint URL */}
              <FormField
                control={form.control}
                name="endpoint_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endpoint URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. /api/internal/tools/cases/search"
                        className="font-mono text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* HTTP Method */}
              <FormField
                control={form.control}
                name="http_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HTTP Method</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Parameters (JSON Schema) */}
              <FormField
                control={form.control}
                name="parameters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parameters (JSON Schema)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='{"type": "object", "properties": {}}'
                        className="min-h-[160px] resize-y font-mono text-xs"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      JSON Schema format. Define the tool&apos;s input parameters.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Timeout & Retry Row */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="timeout_seconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeout (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="5"
                          max="120"
                          placeholder="30"
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
                  name="retry_count"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retry Count</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="5"
                          placeholder="0"
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

              {/* Switches */}
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="requires_auth"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <FormLabel className="text-sm font-medium cursor-pointer">
                        Requires Authentication
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
                {isEditMode ? 'Save Changes' : 'Create Tool'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
