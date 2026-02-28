'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Globe, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { FolderColorPicker } from './FolderColorPicker';
import { FolderIconPicker } from './FolderIconPicker';
import { useCreateFolder } from '@/lib/hooks/useFolders';
import { extractApiError } from '@/lib/utils/api-error';

/******************************************************************************
                               Constants
******************************************************************************/

const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required.').max(255, 'Name must be 255 characters or less.'),
  description: z.string().max(1000, 'Description must be 1000 characters or less.').optional().or(z.literal('')),
  icon: z.string().max(50).optional().or(z.literal('')),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color.').optional().or(z.literal('')),
  is_private: z.boolean().optional(),
});

type CreateFolderFormData = z.infer<typeof createFolderSchema>;

/******************************************************************************
                               Types
******************************************************************************/

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Default component. Dialog for creating a new folder.
 */
function CreateFolderDialog({ open, onOpenChange, parentId }: CreateFolderDialogProps) {
  const createFolder = useCreateFolder();
  const form = useForm<CreateFolderFormData>({
    resolver: zodResolver(createFolderSchema),
    defaultValues: {
      name: '',
      description: '',
      icon: '',
      color: '',
      is_private: false,
    },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      form.reset({
        name: '',
        description: '',
        icon: '',
        color: '',
        is_private: false,
      });
    }
  }, [open, form]);

  // Submit handler
  const onSubmit = async (data: CreateFolderFormData) => {
    try {
      const result = await createFolder.mutateAsync({
        name: data.name,
        description: data.description || undefined,
        icon: data.icon || undefined,
        color: data.color || undefined,
        is_private: data.is_private || undefined,
        parent_id: parentId || undefined,
      });
      toast.success(result.message || 'Folder created successfully.');
      onOpenChange(false);
    } catch (error) {
      const apiError = extractApiError(error);
      if (apiError.errors) {
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          form.setError(field as keyof CreateFolderFormData, { message: messages[0] });
        });
      } else {
        toast.error(apiError.message);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{parentId ? 'Create Subfolder' : 'Create Folder'}</DialogTitle>
          <DialogDescription>
            {parentId
              ? 'Create a new subfolder inside the current folder.'
              : 'Create a new folder to organize your content.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Work Documents" {...field} />
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What is this folder for?"
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Icon & Color */}
            <div className="flex items-center gap-4">
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <FormControl>
                      <FolderIconPicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <FolderColorPicker
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Visibility toggle */}
            <FormField
              control={form.control}
              name="is_private"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    {field.value ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <FormLabel className="text-sm font-medium">
                        {field.value ? 'Private' : 'Shared'}
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        {field.value
                          ? 'Only you can see this folder'
                          : 'Visible to everyone'}
                      </p>
                    </div>
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createFolder.isPending}>
                {createFolder.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export { CreateFolderDialog };
