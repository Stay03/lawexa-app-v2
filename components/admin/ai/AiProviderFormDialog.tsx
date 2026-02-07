'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import {
  useCreateAiProvider,
  useUpdateAiProvider,
} from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiProvider, AdminAiUpdateProviderData } from '@/types/admin-ai';

interface AiProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: AdminAiProvider | null;
}

const slugRegex = /^[a-z0-9-_]+$/;

function getProviderSchema(isEditMode: boolean) {
  return z.object({
    name: z.string().min(1, 'Provider name is required').max(255),
    slug: z
      .string()
      .min(1, 'Slug is required')
      .max(100)
      .regex(slugRegex, 'Slug must contain only lowercase letters, numbers, hyphens, and underscores'),
    base_url: z.string().min(1, 'Base URL is required').url('Base URL must be a valid URL').max(500),
    api_key: isEditMode
      ? z.string().optional()
      : z.string().min(1, 'API key is required'),
    is_active: z.boolean().optional(),
  });
}

type ProviderFormData = z.infer<ReturnType<typeof getProviderSchema>>;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function AiProviderFormDialog({
  open,
  onOpenChange,
  provider,
}: AiProviderFormDialogProps) {
  const isEditMode = !!provider;
  const slugManuallyEdited = useRef(false);

  const createMutation = useCreateAiProvider();
  const updateMutation = useUpdateAiProvider();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const schema = useMemo(() => getProviderSchema(isEditMode), [isEditMode]);

  const form = useForm<ProviderFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      base_url: '',
      api_key: '',
      is_active: true,
    },
  });

  // Reset form when dialog opens/closes or provider changes
  useEffect(() => {
    if (open) {
      slugManuallyEdited.current = false;
      if (provider) {
        form.reset({
          name: provider.name,
          slug: provider.slug,
          base_url: provider.base_url,
          api_key: '',
          is_active: provider.is_active,
        });
      } else {
        form.reset({
          name: '',
          slug: '',
          base_url: '',
          api_key: '',
          is_active: true,
        });
      }
    }
  }, [open, provider, form]);

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

  const onSubmit = (data: ProviderFormData) => {
    const submitData = { ...data };
    // Strip empty api_key in edit mode
    if (isEditMode && !submitData.api_key) {
      delete submitData.api_key;
    }

    const onSuccess = (response: { message: string }) => {
      toast.success(response.message);
      onOpenChange(false);
    };

    const onError = (error: unknown) => {
      const apiError = extractApiError(error);
      if (apiError.errors) {
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          form.setError(field as keyof ProviderFormData, {
            message: messages[0],
          });
        });
      } else {
        toast.error(apiError.message);
      }
    };

    if (isEditMode && provider) {
      updateMutation.mutate(
        { id: provider.id, data: submitData as AdminAiUpdateProviderData },
        { onSuccess, onError }
      );
    } else {
      createMutation.mutate(
        submitData as { name: string; slug: string; base_url: string; api_key: string; is_active?: boolean },
        { onSuccess, onError }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Provider' : 'Add Provider'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the provider configuration.'
              : 'Configure a new AI provider with API credentials.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. OpenRouter"
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

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. openrouter"
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

            <FormField
              control={form.control}
              name="base_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base URL</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://api.example.com/v1"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    API Key
                    {isEditMode && (
                      <span className="ml-1 text-xs text-muted-foreground font-normal">
                        (leave blank to keep current)
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder={isEditMode ? '••••••••' : 'sk-...'}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
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

            <DialogFooter>
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
                {isEditMode ? 'Save Changes' : 'Create Provider'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
