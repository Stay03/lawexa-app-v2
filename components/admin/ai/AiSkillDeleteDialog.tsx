'use client';

import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteAiSkill } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiSkill } from '@/types/admin-ai';

interface AiSkillDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: AdminAiSkill | null;
  /** After a delete, e.g. back to the list from the skill's own page. */
  onDeleted?: () => void;
}

/**
 * Delete a skill. Refused while the skill is on an agent (the server's 422:
 * "Detach this skill from all agents before deleting it."), so the button is
 * off then. The skill is soft-deleted on the server: its versions and its
 * usage stay, and its name stays taken.
 */
export function AiSkillDeleteDialog({ open, onOpenChange, skill, onDeleted }: AiSkillDeleteDialogProps) {
  const deleteMutation = useDeleteAiSkill();

  if (!skill) return null;
  const attached = skill.agents_count > 0;

  const handleDelete = () => {
    deleteMutation.mutate(skill.id, {
      onSuccess: (response) => {
        toast.success(response.message);
        onOpenChange(false);
        onDeleted?.();
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        const agents = (apiError.errors?.agents ?? []) as unknown as { name?: string }[];
        const names = agents.map((agent) => agent?.name).filter(Boolean).join(', ');
        toast.error(names ? `${apiError.message} (${names})` : apiError.message);
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Skill</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Delete <span className="font-semibold text-foreground">{skill.display_name}</span>?
              </p>
              {attached ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="text-sm text-destructive space-y-1">
                    <p>
                      This skill is on {skill.agents_count} {skill.agents_count === 1 ? 'agent' : 'agents'}. Detach
                      it from every agent before deleting it.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm">
                  Lawexa stops seeing it at once. Its versions and usage are kept, and its name stays taken.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={attached || deleteMutation.isPending}>
            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Skill
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
