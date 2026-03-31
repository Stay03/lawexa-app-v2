'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import { useCopyAiWorkflow } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiWorkflow } from '@/types/admin-ai';

interface AiWorkflowCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: AdminAiWorkflow | null;
}

export function AiWorkflowCopyDialog({
  open,
  onOpenChange,
  workflow,
}: AiWorkflowCopyDialogProps) {
  const router = useRouter();
  const copyMutation = useCopyAiWorkflow();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [deep, setDeep] = useState(false);

  const handleCopy = () => {
    if (!workflow) return;

    const data: Record<string, unknown> = {};
    if (name.trim()) data.name = name.trim();
    if (slug.trim()) data.slug = slug.trim();
    if (deep) data.deep = true;

    copyMutation.mutate(
      { id: workflow.id, data },
      {
        onSuccess: (response) => {
          toast.success(response.message);
          onOpenChange(false);
          resetForm();
          if (response.data?.id) {
            router.push(`/admin/ai/workflows/${response.data.id}`);
          }
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          toast.error(apiError.message);
        },
      }
    );
  };

  const resetForm = () => {
    setName('');
    setSlug('');
    setDeep(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  if (!workflow) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy Workflow</DialogTitle>
          <DialogDescription>
            Create a copy of{' '}
            <span className="font-semibold text-foreground">
              {workflow.name}
            </span>
            . Leave fields empty to use defaults.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="copy-workflow-name">Name</Label>
            <Input
              id="copy-workflow-name"
              placeholder={`${workflow.name} (Copy)`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={copyMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="copy-workflow-slug">Slug</Label>
            <Input
              id="copy-workflow-slug"
              placeholder={`${workflow.slug}-copy-...`}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={copyMutation.isPending}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="copy-workflow-deep"
              checked={deep}
              onCheckedChange={(checked) => setDeep(checked === true)}
              disabled={copyMutation.isPending}
            />
            <Label htmlFor="copy-workflow-deep" className="text-sm font-normal">
              Deep copy (clone all agents with their tool assignments)
            </Label>
          </div>

          <p className="text-xs text-muted-foreground">
            Shallow copy reuses existing agents. Deep copy creates independent
            copies of every agent.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={copyMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={copyMutation.isPending}
          >
            {copyMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Copy Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
