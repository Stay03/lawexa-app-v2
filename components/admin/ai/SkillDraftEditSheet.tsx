'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateSkillDraft } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminSkillDraftEdit, SkillDraft, SkillLoadMode } from '@/types/skill-draft';
import { editProblem } from './skill-draft-model';
import {
  SKILL_DESCRIPTION_MAX,
  SKILL_INSTRUCTIONS_MAX,
  counterLabel,
  skillNameProblem,
} from './skill-model';

/**
 * Edit a waiting draft before publishing it (the skills tool): the same fields
 * and limits as the skill form, and the name only for a new skill (a change
 * keeps the live skill's). Only the fields that differ are sent. Opened from
 * the draft page, which keys it by the draft, so it starts on the draft as it
 * stands each time.
 */
export function SkillDraftEditSheet({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: SkillDraft;
}) {
  const update = useUpdateSkillDraft(draft.uuid);
  const [name, setName] = useState(draft.name ?? '');
  const [displayName, setDisplayName] = useState(draft.display_name);
  const [description, setDescription] = useState(draft.description);
  const [instructions, setInstructions] = useState(draft.instructions);
  const [loadMode, setLoadMode] = useState<SkillLoadMode>(draft.load_mode);
  const [changeNote, setChangeNote] = useState(draft.change_note ?? '');
  const [problem, setProblem] = useState<string | null>(null);

  const isNew = draft.kind === 'new';
  const nameProblem = isNew ? skillNameProblem(name) : null;
  const tooLong = description.length > SKILL_DESCRIPTION_MAX || instructions.length > SKILL_INSTRUCTIONS_MAX;
  const empty = !displayName.trim() || !description.trim() || !instructions.trim();

  const edits: AdminSkillDraftEdit = {
    ...(isNew && name !== (draft.name ?? '') && { name }),
    ...(displayName !== draft.display_name && { display_name: displayName }),
    ...(description !== draft.description && { description }),
    ...(instructions !== draft.instructions && { instructions }),
    ...(loadMode !== draft.load_mode && { load_mode: loadMode }),
    ...(changeNote !== (draft.change_note ?? '') && { change_note: changeNote.trim() || null }),
  };
  const changed = Object.keys(edits).length > 0;

  const save = () => {
    setProblem(null);
    update.mutate(edits, {
      onSuccess: () => {
        toast.success('Draft updated.');
        onOpenChange(false);
      },
      onError: (error) => setProblem(editProblem(extractApiError(error))),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit draft</SheetTitle>
          <SheetDescription>
            {isNew
              ? 'Publishing makes a new skill, switched off, from these fields.'
              : `Publishing makes a new version of ${draft.name ?? 'the skill'} from these fields.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="draft-display-name">Display name</Label>
            <Input id="draft-display-name" value={displayName} maxLength={255} onChange={(e) => setDisplayName(e.target.value)} />
          </div>

          {isNew ? (
            <div className="space-y-2">
              <Label htmlFor="draft-name">Name</Label>
              <Input id="draft-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameProblem} />
              <p className={nameProblem ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
                {nameProblem ?? 'Lawexa loads the skill by this name. It cannot change after publishing.'}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="draft-description">Description</Label>
            <Textarea id="draft-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            <p className="text-xs text-muted-foreground tabular-nums">{counterLabel(description.length, SKILL_DESCRIPTION_MAX)}</p>
          </div>

          <div className="space-y-2">
            <Label>Load mode</Label>
            <Select value={loadMode} onValueChange={(value) => setLoadMode(value as SkillLoadMode)}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on_demand">On demand</SelectItem>
                <SelectItem value="always_on">Always on</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="draft-instructions">Steps</Label>
            <Textarea
              id="draft-instructions"
              rows={16}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground tabular-nums">{counterLabel(instructions.length, SKILL_INSTRUCTIONS_MAX)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="draft-change-note">Change note (optional)</Label>
            <Input id="draft-change-note" value={changeNote} maxLength={500} onChange={(e) => setChangeNote(e.target.value)} />
          </div>

          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : null}
        </div>

        <SheetFooter className="px-6 pb-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={!changed || empty || tooLong || !!nameProblem || update.isPending}>
            {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save draft
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
