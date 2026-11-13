'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRejectSkillDraft } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { SkillDraft } from '@/types/skill-draft';
import { editProblem } from './skill-draft-model';

const NOTE_MAX = 500;

/**
 * Reject a waiting draft, with an optional note (at most 500 characters). The
 * person's card in their chat then reads "Not approved"; nobody is messaged
 * (Arthur, 4B). The note stays with the draft for the next admin.
 */
export function SkillDraftRejectDialog({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: SkillDraft;
}) {
  const reject = useRejectSkillDraft(draft.uuid);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const submit = () => {
    setProblem(null);
    reject.mutate(note.trim() || null, {
      onSuccess: () => {
        toast.success('Draft rejected.');
        onOpenChange(false);
      },
      onError: (error) => setProblem(editProblem(extractApiError(error))),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this draft?</DialogTitle>
          <DialogDescription>
            {draft.display_name} will not be published. The card in the person&apos;s chat will say it was not approved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-note">Note (optional)</Label>
          <Textarea
            id="reject-note"
            rows={3}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why it was not approved"
          />
          <p className="text-xs text-muted-foreground tabular-nums">
            {note.length} / {NOTE_MAX}
          </p>
          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={reject.isPending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={reject.isPending}>
            {reject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
