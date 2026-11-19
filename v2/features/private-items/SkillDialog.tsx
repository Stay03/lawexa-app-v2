'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { extractApiError } from '@/lib/utils/api-error';
import type { MySkill, MySkillInput } from '@/types/private-items';
import { SKILL_LIMITS, skillProblems } from './model';

type Field = keyof MySkillInput;

/**
 * Write or edit one of your own skills: a name, one line saying what it is
 * for, and the steps Lawexa follows. It works at once in your own chats, with
 * no admin review (Stay, 18 November 2026). Lawexa reads only the one line
 * until a task needs the steps, so a long skill costs little.
 *
 * Mounted per open (the host keys it), so the fields start from the skill
 * being edited. The server's sentences (a name already taken, by you or by
 * one of Lawexa's skills) show under their field.
 */
export function SkillDialog({
  skill,
  onSave,
  onClose,
}: {
  /** Null to write a new one. */
  skill: MySkill | null;
  onSave: (input: MySkillInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const [input, setInput] = useState<MySkillInput>({
    display_name: skill?.display_name ?? '',
    description: skill?.description ?? '',
    instructions: skill?.instructions ?? '',
  });
  const [tried, setTried] = useState(false);
  const [serverProblems, setServerProblems] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const local = skillProblems(input);
  const problemOf = (field: Field) => serverProblems[field] ?? (tried ? local[field] : undefined);

  const set = (field: Field, value: string) => {
    setInput((current) => ({ ...current, [field]: value }));
    setServerProblems((current) => ({ ...current, [field]: undefined }));
  };

  const save = async () => {
    setTried(true);
    if (Object.keys(local).length > 0) return;
    setSaving(true);
    try {
      await onSave({
        display_name: input.display_name.trim(),
        description: input.description.trim(),
        instructions: input.instructions.trim(),
      });
    } catch (error) {
      const apiError = extractApiError(error);
      const fields = apiError.errors ?? {};
      setServerProblems({
        // A name clash comes back on `name`, the snake_case key made from the display name.
        display_name: fields.name?.[0] ?? fields.display_name?.[0],
        description: fields.description?.[0],
        instructions: fields.instructions?.[0],
      });
      if (!fields.name && !fields.display_name && !fields.description && !fields.instructions) {
        setServerProblems({ display_name: apiError.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const field = (id: Field, label: string, control: React.ReactNode, hint?: string) => {
    const problem = problemOf(id);
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={`skill-${id}`}>{label}</Label>
        {control}
        {problem ? (
          <p id={`skill-${id}-error`} role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    );
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{skill ? 'Edit skill' : 'New skill'}</DialogTitle>
            <DialogDescription>It works at once, in your own chats only.</DialogDescription>
          </DialogHeader>
          {field(
            'display_name',
            'Name',
            <Input
              id="skill-display_name"
              value={input.display_name}
              maxLength={SKILL_LIMITS.display_name}
              autoFocus={!skill}
              placeholder="Tenancy notice review"
              onChange={(event) => set('display_name', event.target.value)}
              aria-invalid={problemOf('display_name') !== undefined}
              aria-describedby={problemOf('display_name') ? 'skill-display_name-error' : undefined}
            />,
          )}
          {field(
            'description',
            'What it is for',
            <Input
              id="skill-description"
              value={input.description}
              maxLength={SKILL_LIMITS.description}
              placeholder="Checks a quit notice against the Lagos Tenancy Law"
              onChange={(event) => set('description', event.target.value)}
              aria-invalid={problemOf('description') !== undefined}
              aria-describedby={problemOf('description') ? 'skill-description-error' : undefined}
            />,
            'One line. Lawexa reads this to decide when to use the skill.',
          )}
          {field(
            'instructions',
            'Steps',
            <Textarea
              id="skill-instructions"
              value={input.instructions}
              maxLength={SKILL_LIMITS.instructions}
              rows={12}
              placeholder={'1. Ask for the notice and the tenancy agreement.\n2. Check how the notice was served.\n3. …'}
              onChange={(event) => set('instructions', event.target.value)}
              className="min-h-56 font-mono text-[13px] leading-relaxed"
              aria-invalid={problemOf('instructions') !== undefined}
              aria-describedby={problemOf('instructions') ? 'skill-instructions-error' : undefined}
            />,
            'What Lawexa should do, step by step, when the skill fits.',
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              {skill ? 'Save changes' : 'Save skill'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
