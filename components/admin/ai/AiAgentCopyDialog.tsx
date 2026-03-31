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

import { useCopyAiAgent } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiAgent } from '@/types/admin-ai';

interface AiAgentCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AdminAiAgent | null;
}

export function AiAgentCopyDialog({
  open,
  onOpenChange,
  agent,
}: AiAgentCopyDialogProps) {
  const router = useRouter();
  const copyMutation = useCopyAiAgent();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const handleCopy = () => {
    if (!agent) return;

    const data: Record<string, unknown> = {};
    if (name.trim()) data.name = name.trim();
    if (slug.trim()) data.slug = slug.trim();

    copyMutation.mutate(
      { id: agent.id, data },
      {
        onSuccess: (response) => {
          toast.success(response.message);
          onOpenChange(false);
          resetForm();
          if (response.data?.id) {
            router.push(`/admin/ai/agents/${response.data.id}`);
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
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy Agent</DialogTitle>
          <DialogDescription>
            Create a copy of{' '}
            <span className="font-semibold text-foreground">
              {agent.name}
            </span>
            . Leave fields empty to use defaults.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="copy-agent-name">Name</Label>
            <Input
              id="copy-agent-name"
              placeholder={`${agent.name} (Copy)`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={copyMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="copy-agent-slug">Slug</Label>
            <Input
              id="copy-agent-slug"
              placeholder={`${agent.slug}-copy-...`}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={copyMutation.isPending}
            />
          </div>
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
            Copy Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
